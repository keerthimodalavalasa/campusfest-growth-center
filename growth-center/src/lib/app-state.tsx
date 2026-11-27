'use client';
import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useApi } from './api';

export interface MetaCampaign {
  id: string;
  name: string;
  channel: string | null;
  ownerId: string | null;
  status: string;
  origin: string;
  plannedBudget: number | null;
  objective: string | null;
  targetAudience: string | null;
}
export interface TeamMember {
  ownerId: string;
  ownerName: string;
  role: string | null;
}
export interface ColumnSpec {
  name: string;
  label: string;
  type: 'text' | 'int' | 'num' | 'date' | 'ts' | 'enum' | 'bool';
  editable: boolean;
  required?: boolean;
  options?: string[];
}
export interface TableMeta {
  key: string;
  label: string;
  description: string;
  pk: string;
  pkGenerated: boolean;
  columns: ColumnSpec[];
  insertable: boolean;
  deletable: boolean;
}
export interface Meta {
  dataVersion: string;
  event: { name: string; historyStart: string; historyEnd: string; startsAt: number; endsAt: number; timezone: string; currency: string };
  latestDate: string;
  campaigns: MetaCampaign[];
  team: TeamMember[];
  targets: { id: number; effectiveAt: number; identifiedGoal: number; registrationGoal: number; visitorsGoal: number; budget: number; version: string; origin: string }[];
  settings: Record<string, unknown>;
  importStats: { at: string | null; source: string | null; tables: Record<string, { sheet: string; rowsRead: number; imported: number; duplicateIds: number; conflictingDuplicates: number; skippedInvalid: number }>; warnings: string[] } | null;
  tables: TableMeta[];
}

interface AppState {
  meta: Meta | null;
  metaError: string | null;
  asOf: string | null;
  setAsOf: (d: string) => void;
  copilotOpen: boolean;
  setCopilotOpen: (open: boolean) => void;
  /** Send a prompt to the copilot from anywhere (e.g. "Ask why" buttons). */
  askCopilot: (prompt: string) => void;
  pendingPrompt: string | null;
  consumePrompt: () => string | null;
  campaignName: (id: string | null | undefined) => string;
  ownerName: (id: string | null | undefined) => string;
}

const Ctx = createContext<AppState | null>(null);

const COPILOT_KEY = 'gc:copilot';
const COPILOT_EVENT = 'gc:copilot-change';
function subscribeCopilot(cb: () => void) {
  window.addEventListener('storage', cb);
  window.addEventListener(COPILOT_EVENT, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(COPILOT_EVENT, cb);
  };
}
function readCopilot() {
  try {
    return localStorage.getItem(COPILOT_KEY) === 'open';
  } catch {
    return false;
  }
}

const noopSubscribe = () => () => {};

function asOfFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const v = new URLSearchParams(window.location.search).get('asOf');
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const metaQ = useApi<Meta>('/api/meta');
  // the user's explicit choice wins; otherwise ?asOf= from the URL; otherwise the latest data date
  // read through useSyncExternalStore so the server render (null) and the first client render agree
  const urlAsOf = useSyncExternalStore(noopSubscribe, asOfFromUrl, () => null);
  const [chosenAsOf, setChosenAsOf] = useState<string | null>(null);
  const asOf = chosenAsOf ?? urlAsOf ?? metaQ.data?.latestDate ?? null;
  const copilotOpen = useSyncExternalStore(subscribeCopilot, readCopilot, () => false);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  const setAsOf = useCallback((d: string) => {
    setChosenAsOf(d);
    const url = new URL(window.location.href);
    url.searchParams.set('asOf', d);
    window.history.replaceState(window.history.state, '', url.toString());
  }, []);

  const setCopilotOpen = useCallback((open: boolean) => {
    try {
      localStorage.setItem(COPILOT_KEY, open ? 'open' : 'closed');
    } catch {
      /* storage unavailable: the event below still updates this tab */
    }
    window.dispatchEvent(new Event(COPILOT_EVENT));
  }, []);

  const askCopilot = useCallback(
    (prompt: string) => {
      setPendingPrompt(prompt);
      setCopilotOpen(true);
    },
    [setCopilotOpen],
  );
  const consumePrompt = useCallback(() => {
    const p = pendingPrompt;
    setPendingPrompt(null);
    return p;
  }, [pendingPrompt]);

  const value = useMemo<AppState>(() => {
    const cmap = new Map(metaQ.data?.campaigns.map((c) => [c.id, c.name]) ?? []);
    const tmap = new Map(metaQ.data?.team.map((t) => [t.ownerId, t.ownerName]) ?? []);
    return {
      meta: metaQ.data,
      metaError: metaQ.error,
      asOf,
      setAsOf,
      copilotOpen,
      setCopilotOpen,
      askCopilot,
      pendingPrompt,
      consumePrompt,
      campaignName: (id) => (id ? (id === 'UNATTRIBUTED' ? 'Walk-ins / unattributed' : cmap.get(id) ?? id) : '–'),
      ownerName: (id) => (id ? tmap.get(id) ?? id : 'Unassigned'),
    };
  }, [metaQ.data, metaQ.error, asOf, setAsOf, copilotOpen, setCopilotOpen, askCopilot, pendingPrompt, consumePrompt]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}

/** Append ?asOf= to an API URL once the as-of date is known (returns null until then). */
export function useAsOfUrl(path: string): string | null {
  const { asOf } = useApp();
  if (!asOf) return null;
  return `${path}${path.includes('?') ? '&' : '?'}asOf=${asOf}`;
}
