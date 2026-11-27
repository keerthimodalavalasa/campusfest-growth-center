'use client';
import { useCallback, useEffect, useState } from 'react';

/** Fired after any write (UI or copilot approval). Every useApi hook refetches. */
export const DATA_CHANGED = 'gc:data-changed';

export function notifyDataChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(DATA_CHANGED));
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { 'content-type': 'application/json', ...(rest.headers ?? {}) } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: 'no-store',
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) throw new ApiError((data as { error?: string })?.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

/** Write helper: performs the request, then tells every view to refresh. */
export async function mutate<T = unknown>(url: string, method: 'POST' | 'PATCH' | 'DELETE', json?: unknown): Promise<T> {
  const out = await api<T>(url, { method, json });
  notifyDataChanged();
  return out;
}

export interface ApiState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

/** Fetch JSON for a URL; refetches when the URL changes or when data changes anywhere in the app. */
export function useApi<T>(url: string | null): ApiState<T> {
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState<{ key: string; data: T | null; error: string | null } | null>(null);
  const [lastData, setLastData] = useState<T | null>(null);
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  const key = url ? `${url}#${tick}` : null;

  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(DATA_CHANGED, on);
    return () => window.removeEventListener(DATA_CHANGED, on);
  }, []);

  useEffect(() => {
    if (!url || !key) return;
    let live = true;
    api<T>(url)
      .then((d) => {
        if (!live) return;
        setResult({ key, data: d, error: null });
        setLastData(d);
      })
      .catch((e: Error) => {
        if (live) setResult({ key, data: null, error: e.message });
      });
    return () => {
      live = false;
    };
  }, [url, key]);

  const settled = result?.key === key;
  return {
    // keep showing the previous data while a refetch is in flight (no flash of empty UI)
    data: settled ? (result!.data ?? lastData) : lastData,
    error: settled ? result!.error : null,
    loading: !!url && !settled,
    refresh,
  };
}
