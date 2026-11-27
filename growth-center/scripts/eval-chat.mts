/**
 * Copilot evaluation harness. Runs a suite of questions against a running Growth Center
 * (default http://localhost:3100) and grades the answers against the verified ground truth.
 *
 *   npx tsx scripts/eval-chat.mts [baseUrl] [--only id1,id2]
 *
 * Categories mirror RISA's test plan: unfamiliar questions, calculations, changed data,
 * follow-ups, recommendations, execution (task with approval) and "the data cannot answer".
 * Writes a Markdown report to ../research/chat_eval.md.
 */
import { writeFileSync } from 'node:fs';

const BASE = process.argv[2]?.startsWith('http') ? process.argv[2] : 'http://localhost:3100';
const only = (() => {
  const i = process.argv.indexOf('--only');
  return i > -1 ? new Set(process.argv[i + 1].split(',')) : null;
})();

type Msg = { id: string; role: 'user' | 'assistant'; parts: { type: 'text'; text: string }[] };
interface Turn {
  text: string;
  tools: { name: string; input: unknown; output?: unknown }[];
  approvals: { approvalId: string; toolCallId: string; toolName?: string }[];
  error?: string;
  ms: number;
}

async function ask(messages: Msg[], asOf?: string): Promise<Turn> {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages, asOf, page: '/eval' }) });
  if (!res.ok || !res.body) return { text: '', tools: [], approvals: [], error: `HTTP ${res.status}: ${await res.text()}`, ms: Date.now() - t0 };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  const turn: Turn = { text: '', tools: [], approvals: [], ms: 0 };
  const byId = new Map<string, { name: string; input: unknown; output?: unknown }>();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(payload);
      } catch {
        continue;
      }
      switch (ev.type) {
        case 'text-delta':
          turn.text += String(ev.delta ?? '');
          break;
        case 'tool-input-available': {
          const t = { name: String(ev.toolName), input: ev.input };
          byId.set(String(ev.toolCallId), t);
          turn.tools.push(t);
          break;
        }
        case 'tool-output-available': {
          const t = byId.get(String(ev.toolCallId));
          if (t) t.output = ev.output;
          break;
        }
        case 'tool-approval-request':
          turn.approvals.push({ approvalId: String(ev.approvalId), toolCallId: String(ev.toolCallId), toolName: byId.get(String(ev.toolCallId))?.name });
          break;
        case 'error':
          turn.error = String(ev.errorText ?? 'error');
          break;
      }
    }
  }
  turn.ms = Date.now() - t0;
  return turn;
}

const norm = (s: string) => s.toLowerCase().replace(/[₹, ]/g, '').replace(/\s+/g, ' ');
const has = (text: string, needle: string | RegExp) => (typeof needle === 'string' ? norm(text).includes(norm(needle)) : needle.test(text));

/**
 * Grounding audit: numbers in the answer that appear in no tool input/output of the conversation
 * (allowing rounding and fraction-to-percent). Derived numbers (differences, ratios the model
 * computed) are flagged too, so this is a review list, not a pass/fail rule.
 */
function ungroundedNumbers(text: string, turns: Turn[], prompts: string[]): string[] {
  const known: number[] = [];
  const collect = (v: unknown) => {
    for (const m of JSON.stringify(v ?? '').matchAll(/-?\d+(?:\.\d+)?/g)) {
      const x = Math.abs(Number(m[0]));
      known.push(x, x * 100);
    }
  };
  for (const t of turns) for (const tool of t.tools) { collect(tool.input); collect(tool.output); }
  for (const p of prompts) collect(p);
  const close = (a: number) => known.some((k) => Math.abs(k - a) <= Math.max(0.051, a * 0.0005) || Math.round(k) === a || Math.round(k * 10) / 10 === a);
  const out = new Set<string>();
  for (const m of text.matchAll(/(?<![\w.-])(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?![\w])/g)) {
    const raw = m[1];
    const a = Number(raw.replace(/,/g, ''));
    if (!Number.isFinite(a) || (Number.isInteger(a) && a <= 31) || (a >= 2024 && a <= 2028)) continue; // days, hours, years
    if (!close(a)) out.add(raw);
  }
  return [...out];
}

interface Case {
  id: string;
  category: string;
  asOf?: string;
  prompts: string[]; // multiple = follow-up conversation
  mustInclude?: (string | RegExp)[]; // checked on the LAST answer
  anyOf?: (string | RegExp)[]; // at least one must appear
  lead?: RegExp; // must match the answer's first paragraph (the direct answer), not just appear somewhere
  mustNotInclude?: (string | RegExp)[];
  toolsUsed?: string[]; // at least one of these tools must be called in the last turn
  expectApproval?: string; // a write tool that must raise an approval request
  setup?: () => Promise<() => Promise<void>>; // mutate data, return a restore function
  note: string;
}

const CASES: Case[] = [
  { id: 'visitors', category: 'fact', prompts: ['How many unique verified external visitors attended the festival?'], mustInclude: ['2050'], toolsUsed: ['get_overview', 'get_campaign_metrics', 'query_data'], note: 'Headline North Star with the dedupe and verification rules applied.' },
  { id: 'show-paid', category: 'fact', prompts: ['What share of Paid Social registrants actually attended?'], mustInclude: ['50'], note: 'Campaign-level show rate.' },
  { id: 'cheapest', category: 'calc', prompts: ['Which campaign had the lowest cost per verified visitor, and how much was it?'], mustInclude: ['Student Referrals', '69'], note: 'Ranking + cost metric.' },
  { id: 'budget', category: 'calc', prompts: ['How much have we spent and what percentage of the approved budget is that?'], mustInclude: ['274000'], anyOf: ['91.3', '91.33'], note: 'Net spend incl. vendor credits vs revised budget.' },
  { id: 'asof-march', category: 'as-of', prompts: ['How many people had registered by 1 March 2025, and what was the registration goal in force on that date?'], mustInclude: ['1144', '2800'], note: 'Snapshot semantics + target version in force.' },
  { id: 'waitlist', category: 'fact', prompts: ['How many registrants are still waitlisted, and did any waitlisted person attend?'], mustInclude: ['88'], note: 'Latest full-state status.' },
  { id: 'both-days', category: 'unfamiliar', prompts: ['How many unique visitors came on both festival days?'], mustInclude: ['725'], toolsUsed: ['get_event_day', 'query_data'], note: 'Repeat visits across days. Ground truth 725 (analysis/out/deep_dive.json). Answerable via get_event_day or SQL.' },
  { id: 'peak-hour', category: 'unfamiliar', prompts: ['At what hour on the first festival day did the most people enter for the first time?'], mustInclude: ['251'], lead: /\b11(:00)?\s?(am|a\.m\.)?\b|11:00/i, toolsUsed: ['get_event_day', 'query_data'], note: 'Ops question: first entries by hour on day 1. Ground truth 11:00-12:00 IST with 251 people (analysis/out/deep_dive.json).' },
  { id: 'optout', category: 'calc', prompts: ['What percentage of identified people opted out in Paid Social?'], mustInclude: ['12.2'], note: 'Rate with the right denominator.' },
  { id: 'dip', category: 'diagnose', prompts: ['Why did registrations dip in the week of 3 March 2025?'], mustInclude: ['Paid Social'], anyOf: ['105', '35', 'College Partnerships'], note: 'Driver analysis.' },
  { id: 'stop', category: 'recommend', prompts: ['Which campaigns should we stop or change, and why? Use the evidence.'], mustInclude: ['Paid Social', 'Creator Partners'], toolsUsed: ['get_decisions', 'compare_campaigns', 'get_campaign_metrics'], note: 'Decision rules with evidence.' },
  { id: 'simulate', category: 'recommend', prompts: ['If we moved ₹30,000 from Paid Social to College Partnerships, what would happen to visitors?'], toolsUsed: ['simulate_budget_shift'], anyOf: ['assum', 'elasticity', 'curve'], note: 'What-if with the assumption disclosed.' },
  { id: 'college', category: 'cannot-answer', prompts: ['Which college sent the most attendees?'], anyOf: [/not (in|available|contain|record|track)/i, /doesn.t (contain|include|have|record|track)/i, /cannot/i, /can.t/i, /no (college|data)/i], mustNotInclude: [/IIT|JNTU|Osmania|BITS/], note: 'Must refuse to invent colleges.' },
  { id: 'gender', category: 'cannot-answer', prompts: ['What was the gender split of attendees?'], anyOf: [/not (in|available|contain|record|track)/i, /doesn.t (contain|include|have|record|track)/i, /cannot/i, /can.t/i], note: 'Demographics are not in the data.' },
  { id: 'causal', category: 'uncertainty', prompts: ['Did the creator campaign cause extra attendance? Give me the incremental lift.'], anyOf: [/causal|incremental|holdout|control group|attribution/i], note: 'Must flag that lift cannot be proven.' },
  { id: 'followup', category: 'follow-up', prompts: ['What was the registrant show rate for Creator Partners?', 'How does that compare with the portfolio average?'], mustInclude: ['68.8'], note: 'Resolves "that" from context.' },
  { id: 'mid-pace', category: 'as-of', asOf: '2025-03-09', prompts: ['Are we on track to hit the registration goal?'], mustInclude: ['2800'], anyOf: ['2358', '2,358', 'projected', 'pace'], note: 'Mid-campaign projection vs the launch-plan goal.' },
  { id: 'task', category: 'execution', prompts: ['Create a task for Arjun to pause Paid Social prospecting and refresh the creative, due next Friday, high priority.'], expectApproval: 'create_task', note: 'Write action must wait for user approval.' },
  {
    id: 'changed-data',
    category: 'changed data',
    prompts: ['What is our total net marketing spend now?'],
    mustInclude: ['284000'],
    setup: async () => {
      const r = await fetch(`${BASE}/api/data/daily_marketing`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ activity_id: 'EVAL-TEST-1', campaign_id: 'C02', activity_date: '2025-03-01', marketing_spend_inr: 10000, platform: 'eval adjustment' }) });
      if (!r.ok) throw new Error(`setup failed: ${await r.text()}`);
      return async () => {
        await fetch(`${BASE}/api/data/daily_marketing/EVAL-TEST-1`, { method: 'DELETE' });
      };
    },
    note: 'Inserts ₹10,000 of spend, asks again, then restores. Answer must reflect the edit (₹2,84,000).',
  },
];

const results: { c: Case; turns: Turn[]; pass: boolean; reasons: string[]; model?: string; ungrounded?: string[] }[] = [];
const servedBy = async () => { try { return ((await (await fetch(`${BASE}/api/chat`)).json()) as { lastServed?: string }).lastServed ?? ''; } catch { return ''; } };
for (const c of CASES) {
  if (only && !only.has(c.id)) continue;
  let restore: (() => Promise<void>) | null = null;
  try {
    if (c.setup) restore = await c.setup();
    const history: Msg[] = [];
    const turns: Turn[] = [];
    for (const [i, p] of c.prompts.entries()) {
      history.push({ id: `u${i}`, role: 'user', parts: [{ type: 'text', text: p }] });
      const t = await ask(history, c.asOf);
      turns.push(t);
      history.push({ id: `a${i}`, role: 'assistant', parts: [{ type: 'text', text: t.text || '(no text)' }] });
      await new Promise((r) => setTimeout(r, 1500));
    }
    const last = turns[turns.length - 1];
    const reasons: string[] = [];
    if (last.error) reasons.push(`error: ${last.error}`);
    for (const m of c.mustInclude ?? []) if (!has(last.text, m)) reasons.push(`missing ${m}`);
    if (c.anyOf && !c.anyOf.some((m) => has(last.text, m))) reasons.push(`none of ${c.anyOf.map(String).join(' | ')}`);
    if (c.lead && !c.lead.test(last.text.trim().split(/\n\s*\n/)[0] ?? '')) reasons.push(`direct answer does not match ${c.lead}`);
    for (const m of c.mustNotInclude ?? []) if (has(last.text, m)) reasons.push(`should not include ${m}`);
    if (c.toolsUsed && !last.tools.some((t) => c.toolsUsed!.includes(t.name))) reasons.push(`expected a tool from ${c.toolsUsed.join('/')}, used ${last.tools.map((t) => t.name).join(', ') || 'none'}`);
    if (c.expectApproval && !last.approvals.some((a) => a.toolName === c.expectApproval)) reasons.push(`expected an approval request for ${c.expectApproval}`);
    const model = await servedBy();
    const ungrounded = [...new Set(turns.flatMap((t, i) => ungroundedNumbers(t.text, turns.slice(0, i + 1), c.prompts)))];
    results.push({ c, turns, pass: reasons.length === 0, reasons, model, ungrounded });
    console.log(`${reasons.length ? 'FAIL' : 'PASS'}  ${c.id.padEnd(14)} ${String(last.ms).padStart(6)}ms  ${model.padEnd(22)} tools=[${last.tools.map((t) => t.name).join(',')}] ${reasons.join('; ')}${ungrounded.length ? `  [check numbers: ${ungrounded.join(', ')}]` : ''}`);
  } catch (e) {
    results.push({ c, turns: [], pass: false, reasons: [(e as Error).message] });
    console.log(`FAIL  ${c.id}  ${(e as Error).message}`);
  } finally {
    if (restore) await restore();
  }
  // space cases out so free-tier per-minute limits are not what is being measured
  await new Promise((r) => setTimeout(r, Number(process.env.EVAL_GAP_MS) || 6000));
}

const passed = results.filter((r) => r.pass).length;
const md = [
  `# Copilot evaluation`,
  ``,
  `Run against ${BASE} on ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. **${passed}/${results.length} passed.**`,
  ``,
  `| Case | Category | Result | Tools called | Model (last step) | Numbers not found in tool outputs (review) | Time |`,
  `|---|---|---|---|---|---|---|`,
  ...results.map((r) => `| ${r.c.id} | ${r.c.category} | ${r.pass ? 'pass' : `FAIL: ${r.reasons.join('; ').replace(/\|/g, '/')}`} | ${r.turns.at(-1)?.tools.map((t) => t.name).join(', ') ?? ''} | ${r.model ?? ''} | ${r.ungrounded?.join(', ') || 'none'} | ${((r.turns.at(-1)?.ms ?? 0) / 1000).toFixed(1)}s |`),
  ``,
  `## Transcripts`,
  ...results.flatMap((r) => [
    ``,
    `### ${r.c.id} (${r.c.category})`,
    `_${r.c.note}_`,
    ...r.c.prompts.flatMap((p, i) => [``, `**Q${r.c.prompts.length > 1 ? i + 1 : ''}:** ${p}`, ``, `Tools: ${r.turns[i]?.tools.map((t) => `\`${t.name}(${JSON.stringify(t.input).slice(0, 120)})\``).join(', ') || 'none'}${r.turns[i]?.approvals.length ? ` ; approval requested for ${r.turns[i].approvals.map((a) => a.toolName).join(', ')}` : ''}`, ``, (r.turns[i]?.text || r.turns[i]?.error || '(empty)').trim()]),
  ]),
].join('\n');
const outName = only ? 'chat_eval_rerun.md' : 'chat_eval.md'; // a partial (--only) run never overwrites the full report
writeFileSync(new URL(`../../research/${outName}`, import.meta.url), md, 'utf8');
console.log(`\n${passed}/${results.length} passed. Report: research/${outName}`);
