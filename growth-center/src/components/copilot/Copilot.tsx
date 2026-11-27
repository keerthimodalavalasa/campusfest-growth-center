'use client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses, type UIMessage } from 'ai';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Square } from 'lucide-react';
import { ArrowUpDuotone, RotateCcwDuotone, XDuotone } from 'runeicons-react';
import { notifyDataChanged } from '@/lib/api';
import { useApp } from '@/lib/app-state';
import { dateLabel } from '@/lib/format';
import { cx, Ico } from '@/components/ui';
import FluidOrb from '@/components/vendor/fluid-orb';
import { Markdown } from './Markdown';
import { ToolPart, type AnyToolPart } from './ToolPart';

const STORE = 'gc:copilot-messages';
const WRITE_TOOLS = new Set(['tool-create_task', 'tool-update_task', 'tool-update_campaign']);
const ORB = '#a3123a'; // lac

const STARTERS = [
  'How are we tracking against the visitor target?',
  'Which campaigns should we scale and which should we stop? Show the evidence.',
  'Why did registrations dip in the week of 3 March 2025?',
  'Compare show-up rates by campaign.',
  'What happens if we move ₹30,000 from Paid Social to College Partnerships?',
  'Which colleges sent the most attendees?',
];

function loadMessages(): UIMessage[] {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as UIMessage[]) : [];
  } catch {
    return [];
  }
}

const headBtn = 'grid size-9 place-items-center rounded-full bg-bidri-2 text-white transition-[background-color,transform] duration-150 hover:bg-bidri-3 active:scale-[0.95]';

/**
 * The copilot drawer: the one raised surface in the Bento system. It slides in from the right over a light scrim
 * (and leaves instantly). Chat logic is unchanged: useChat with the AI SDK transport, approvals for writes.
 */
export function Copilot() {
  const { copilotOpen, setCopilotOpen, asOf, consumePrompt, pendingPrompt } = useApp();
  const [initial] = useState<UIMessage[]>(() => (typeof window === 'undefined' ? [] : loadMessages()));
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const seenWrites = useRef(new Set<string>());

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        // page and as-of date are read from the URL at send time (AppState keeps ?asOf= in sync), so no refs or Suspense are needed
        body: () => (typeof window === 'undefined' ? {} : { asOf: new URL(window.location.href).searchParams.get('asOf'), page: window.location.pathname }),
      }),
    [],
  );

  const { messages, sendMessage, status, stop, error, setMessages, addToolApprovalResponse, clearError } = useChat({
    transport,
    messages: initial,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  });

  // persist the conversation and refresh analytics after the copilot writes data
  useEffect(() => {
    try {
      localStorage.setItem(STORE, JSON.stringify(messages.slice(-40)));
    } catch {
      /* storage full or unavailable */
    }
    for (const m of messages) {
      for (const p of m.parts) {
        const tp = p as AnyToolPart;
        if (WRITE_TOOLS.has(p.type) && tp.state === 'output-available' && tp.toolCallId && !seenWrites.current.has(tp.toolCallId)) {
          seenWrites.current.add(tp.toolCallId);
          notifyDataChanged();
        }
      }
    }
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, status]);

  // prompts sent from "Ask the copilot" buttons elsewhere in the app
  useEffect(() => {
    if (!copilotOpen || !pendingPrompt || status === 'streaming' || status === 'submitted') return;
    const p = consumePrompt();
    if (p) sendMessage({ text: p });
  }, [copilotOpen, pendingPrompt, consumePrompt, sendMessage, status]);

  // drawer focus: move into the drawer on open, Esc closes, focus returns to the opener on close
  useEffect(() => {
    if (!copilotOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCopilotOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [copilotOpen, setCopilotOpen]);

  const busy = status === 'submitted' || status === 'streaming';
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    const t = input.trim();
    if (!t || busy) return;
    sendMessage({ text: t });
    setInput('');
  };

  if (!copilotOpen) return null;

  return (
    <>
      <div aria-hidden className="scrim-in fixed inset-0 z-[70] bg-[#1a1d2352]" onClick={() => setCopilotOpen(false)} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="copilot-title"
        className="drawer-in fixed inset-y-0 right-0 z-[80] flex w-[min(460px,100vw)] flex-col bg-ground shadow-[-20px_0_60px_rgba(26,29,35,0.18)]"
      >
        <div className="field-bidri flex items-center gap-3 py-4 pr-4 pl-5">
          <FluidOrb size={32} color={ORB} animate={busy} />
          <div className="min-w-0 leading-tight">
            <h2 id="copilot-title" className="text-[16px] font-[700]">
              Growth copilot
            </h2>
            <div className="mt-0.5 text-[12.5px] font-[550] text-silver-2">Answers from live data as of {asOf ? dateLabel(asOf, true) : '…'}</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                stop();
                setMessages([]);
                seenWrites.current.clear();
                clearError();
              }}
              className={headBtn}
              title="New conversation"
              aria-label="New conversation"
            >
              <Ico icon={RotateCcwDuotone} size={18} ia="#fff" ib="var(--silver-2)" />
            </button>
            <button ref={closeRef} type="button" onClick={() => setCopilotOpen(false)} className={headBtn} aria-label="Close copilot">
              <Ico icon={XDuotone} size={18} ia="#fff" ib="var(--silver-2)" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-5" aria-live="polite">
          {messages.length === 0 ? (
            <div className="space-y-3.5">
              <p className="rounded-[16px_16px_16px_4px] bg-stone px-4 py-3.5 text-[14px] leading-[1.5] text-ink">
                Ask about funnel performance, bottlenecks, budget moves or next actions. Every number comes from a tool call on the current data, and I will say when the data cannot answer.
              </p>
              <div className="flex flex-wrap gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage({ text: s })}
                    className="rounded-full bg-stone px-3 py-2 text-left text-[13px] font-[600] text-ink transition-[background-color,transform] duration-150 hover:bg-stone-2 active:scale-[0.97]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="ml-10 max-w-[92%] self-end rounded-[16px_16px_4px_16px] bg-ink px-3.5 py-2.5 text-[14px] leading-[1.5] font-[550] text-white">
                {m.parts.map((p, i) => (p.type === 'text' ? <span key={i}>{p.text}</span> : null))}
              </div>
            ) : (
              <div key={m.id} className="flex max-w-[96%] flex-col gap-2 self-start">
                {m.parts.map((p, i) => {
                  if (p.type === 'text')
                    return p.text.trim() ? (
                      <div key={i} className="rounded-[16px_16px_16px_4px] bg-stone px-4 py-3.5">
                        <Markdown text={p.text} />
                      </div>
                    ) : null;
                  if (p.type.startsWith('tool-')) return <ToolPart key={i} part={p as AnyToolPart} onApproval={(id, approved) => addToolApprovalResponse({ id, approved })} />;
                  return null;
                })}
              </div>
            ),
          )}

          {status === 'submitted' ? (
            <div className="flex items-center gap-2 text-[13px] font-[550] text-ink-2">
              <FluidOrb size={18} color={ORB} />
              Reading the data…
            </div>
          ) : null}
          {error ? (
            <div role="alert" className="rounded-tile-m bg-stone px-3.5 py-2.5 text-[13px] text-ink">
              <span className="font-[650] text-st-stop">The copilot could not answer.</span> {error.message}{' '}
              <button type="button" className="font-[650] underline underline-offset-2" onClick={() => clearError()}>
                Dismiss
              </button>
            </div>
          ) : null}
          <div ref={endRef} />
        </div>

        <form onSubmit={submit} className="border-t border-stone-2 px-4 pt-3 pb-4">
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex h-6 items-center rounded-full bg-stone px-2.5 text-[12px] font-[600] text-ink-2" title="The copilot answers for this date unless you name another one">
              Data as of {asOf ? dateLabel(asOf, true) : '…'}
            </span>
            <span className="inline-flex h-6 items-center rounded-full bg-stone px-2.5 text-[12px] font-[600] text-ink-2">Gemini, grounded in tools</span>
          </div>
          <div className="flex items-end gap-2 rounded-[22px] border-[1.5px] border-stone-3 bg-ground py-1 pr-1 pl-3 transition-colors duration-150 focus-within:border-ink">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={1}
              placeholder="Ask about this view"
              aria-label="Message the copilot"
              className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent py-2.5 text-[14px] leading-[1.4] placeholder:text-ink-2/80 focus:outline-none"
            />
            {busy ? (
              <button type="button" onClick={() => stop()} className="grid size-10 shrink-0 place-items-center rounded-full bg-stone-2 text-ink transition-transform duration-150 active:scale-[0.95]" aria-label="Stop">
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className={cx('grid size-10 shrink-0 place-items-center rounded-full text-white transition-[background-color,transform] duration-150 active:scale-[0.95]', input.trim() ? 'bg-ink' : 'bg-stone-3')}
                aria-label="Send"
              >
                <Ico icon={ArrowUpDuotone} size={18} ia="#fff" ib="#fff" />
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 px-1 text-[12px] text-ink-2">
            <span>Tasks and campaign changes wait for your approval.</span>
            <a href="https://rareui.com" target="_blank" rel="noreferrer" className="shrink-0 font-[600] text-ink-2 underline decoration-stone-3 underline-offset-2 hover:text-ink hover:decoration-ink">
              Orb by Rare UI
            </a>
          </div>
        </form>
      </aside>
    </>
  );
}
