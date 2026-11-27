'use client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses, type UIMessage } from 'ai';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, RotateCcw, Square, X } from 'lucide-react';
import { notifyDataChanged } from '@/lib/api';
import { useApp } from '@/lib/app-state';
import { dateLabel } from '@/lib/format';
import { cx } from '@/components/ui';
import FluidOrb from '@/components/vendor/fluid-orb';
import { Markdown } from './Markdown';
import { ToolPart, type AnyToolPart } from './ToolPart';

const STORE = 'gc:copilot-messages';
const WRITE_TOOLS = new Set(['tool-create_task', 'tool-update_task', 'tool-update_campaign']);

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

export function Copilot() {
  const { copilotOpen, setCopilotOpen, asOf, consumePrompt, pendingPrompt } = useApp();
  const [initial] = useState<UIMessage[]>(() => (typeof window === 'undefined' ? [] : loadMessages()));
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
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
    <aside
      aria-label="AI copilot"
      className="fixed inset-0 z-40 flex flex-col bg-surface md:sticky md:top-[67px] md:z-10 md:h-[calc(100vh-67px)] md:w-[440px] md:shrink-0 md:border-l md:border-line"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <FluidOrb size={30} color="#a8174a" animate={busy} />
          <div className="leading-tight">
            <div className="type-title text-[0.98rem]">Growth copilot</div>
            <div className="text-[0.75rem] text-ink-3">Answers from live data as of {asOf ? dateLabel(asOf, true) : '…'}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              stop();
              setMessages([]);
              seenWrites.current.clear();
              clearError();
            }}
            className="rounded-md p-1.5 text-ink-3 hover:bg-paper-2 hover:text-ink"
            title="New conversation"
            aria-label="New conversation"
          >
            <RotateCcw size={16} />
          </button>
          <button onClick={() => setCopilotOpen(false)} className="rounded-md p-1.5 text-ink-3 hover:bg-paper-2 hover:text-ink" aria-label="Close copilot">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[0.9rem] text-ink-2">
              Ask about funnel performance, bottlenecks, budget moves or next actions. Every number comes from a tool call on the current data, and I will say when the data cannot answer.
            </p>
            <div className="flex flex-col gap-1.5">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => sendMessage({ text: s })} className="rounded-lg border border-line px-3 py-2 text-left text-[0.86rem] text-ink hover:border-line-2 hover:bg-paper">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {messages.map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="ml-8 rounded-xl rounded-br-sm bg-ink px-3.5 py-2.5 text-[0.9rem] text-white">
              {m.parts.map((p, i) => (p.type === 'text' ? <span key={i}>{p.text}</span> : null))}
            </div>
          ) : (
            <div key={m.id} className="space-y-2">
              {m.parts.map((p, i) => {
                if (p.type === 'text') return p.text.trim() ? <Markdown key={i} text={p.text} /> : null;
                if (p.type.startsWith('tool-')) return <ToolPart key={i} part={p as AnyToolPart} onApproval={(id, approved) => addToolApprovalResponse({ id, approved })} />;
                return null;
              })}
            </div>
          ),
        )}

        {status === 'submitted' ? (
          <div className="flex items-center gap-2 text-[0.85rem] text-ink-3">
            <FluidOrb size={18} color="#a8174a" />
            Reading the data…
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="rounded-lg border border-lac/30 bg-lac-soft px-3 py-2 text-[0.85rem] text-lac">
            {error.message || 'The copilot could not answer.'}{' '}
            <button className="font-semibold underline" onClick={() => clearError()}>
              Dismiss
            </button>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="border-t border-line p-3">
        <div className="rounded-2xl border border-line-2 bg-surface p-1.5 focus-within:border-sagar">
        <div className="flex items-center gap-1.5 px-1.5 pb-1 pt-0.5">
          <span className="inline-flex h-6 items-center rounded-full bg-paper-2 px-2.5 text-[0.72rem] font-medium text-ink-2" title="The copilot answers for this date unless you name another one">
            Data as of {asOf ? dateLabel(asOf, true) : '…'}
          </span>
          <span className="inline-flex h-6 items-center rounded-full bg-paper-2 px-2.5 text-[0.72rem] font-medium text-ink-2">Gemini, grounded in tools</span>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder="Ask about campaigns, targets, bottlenecks…"
            aria-label="Message the copilot"
            className="max-h-40 min-h-[2.5rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-[0.9rem] focus:outline-none"
          />
          {busy ? (
            <button type="button" onClick={() => stop()} className="grid size-9 place-items-center rounded-lg bg-paper-2 text-ink" aria-label="Stop">
              <Square size={14} />
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} className={cx('grid size-9 place-items-center rounded-lg text-white', input.trim() ? 'bg-ink' : 'bg-line-2')} aria-label="Send">
              <ArrowUp size={16} />
            </button>
          )}
        </div>
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[0.72rem] text-ink-3">
          <span>Tasks and campaign changes wait for your approval.</span>
          <a href="https://rareui.com" target="_blank" rel="noreferrer" className="shrink-0 hover:text-ink-2 hover:underline">
            Orb by Rare UI
          </a>
        </div>
      </form>
    </aside>
  );
}
