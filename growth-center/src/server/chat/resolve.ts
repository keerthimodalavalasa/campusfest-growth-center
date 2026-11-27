import type { Dataset } from '../engine/types';

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Resolve a campaign reference given as an ID ("C02"), a name ("paid social") or a channel ("referrals"). */
export function resolveCampaign(ds: Dataset, ref: string | undefined | null): { id: string; name: string } | null {
  if (!ref) return null;
  const r = norm(ref);
  if (!r) return null;
  if (r === 'walk in' || r === 'walk ins' || r === 'unattributed') return { id: 'UNATTRIBUTED', name: 'Walk-ins / unattributed' };
  const byId = ds.campaigns.find((c) => c.campaignId.toLowerCase() === ref.trim().toLowerCase());
  if (byId) return { id: byId.campaignId, name: byId.name };
  const exact = ds.campaigns.find((c) => norm(c.name) === r || norm(c.channel ?? '') === r);
  if (exact) return { id: exact.campaignId, name: exact.name };
  const partial = ds.campaigns.filter((c) => norm(c.name).includes(r) || r.includes(norm(c.name)) || norm(c.channel ?? '').replace(/ /g, '').includes(r.replace(/ /g, '')));
  if (partial.length === 1) return { id: partial[0].campaignId, name: partial[0].name };
  // token overlap
  const toks = r.split(' ').filter((t) => t.length > 2);
  const scored = ds.campaigns
    .map((c) => ({ c, s: toks.filter((t) => norm(`${c.name} ${c.channel ?? ''}`).includes(t.replace(/s$/, ''))).length }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  if (scored.length && (scored.length === 1 || scored[0].s > scored[1].s)) return { id: scored[0].c.campaignId, name: scored[0].c.name };
  return null;
}

export function resolveOwner(ds: Dataset, ref: string | undefined | null): { id: string; name: string } | null {
  if (!ref) return null;
  const r = norm(ref);
  for (const t of ds.team.values()) {
    if (t.ownerId.toLowerCase() === ref.trim().toLowerCase() || norm(t.ownerName) === r) return { id: t.ownerId, name: t.ownerName };
  }
  const hits = [...ds.team.values()].filter((t) => norm(t.ownerName).split(' ').some((w) => w === r || r.split(' ').includes(w)));
  return hits.length === 1 ? { id: hits[0].ownerId, name: hits[0].ownerName } : null;
}

export function campaignList(ds: Dataset) {
  return ds.campaigns.map((c) => `${c.campaignId} = ${c.name} (${c.channel ?? 'n/a'})`).join('; ');
}

export function teamList(ds: Dataset) {
  return [...ds.team.values()].map((t) => `${t.ownerId} = ${t.ownerName}${t.role ? ` (${t.role})` : ''}`).join('; ');
}
