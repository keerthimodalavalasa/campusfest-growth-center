'use client';
import { MessageSquareTextDuotone } from 'runeicons-react';
import { useApi } from '@/lib/api';
import { useApp, useAsOfUrl } from '@/lib/app-state';
import { Button, ErrorNote, Ico, PageHeader, Skeleton } from '@/components/ui';
import type { Initiative, Plan } from './_components/model';
import { PlanKpis, TargetHero } from './_components/Hero';
import { BudgetTile, PlanFunnelTile, TornadoTile, WaterfallTile } from './_components/Charts';
import { Bets } from './_components/Bets';
import { TimelineTile } from './_components/Timeline';
import { InputsTile } from './_components/Inputs';

/**
 * Plan 2027: the Hyderabad target ladder on the lac hero, then why the base holds (visitors in lac), where the
 * money goes (haldi), the five bets with their ICE gauges and live status, the dated gates, what could move the
 * base, the funnel, and the evidence trail one click down. The plan model is static; bet status is live.
 */
export default function PlanPage() {
  const { askCopilot } = useApp();
  const plan = useApi<Plan>('/api/plan');
  const ini = useApi<{ initiatives: Initiative[] }>(useAsOfUrl('/api/initiatives'));

  if (plan.error) return <ErrorNote onRetry={plan.refresh}>Could not load the 2027 plan: {plan.error}</ErrorNote>;
  if (!plan.data) return <PlanSkeleton />;
  const p = plan.data;
  const byKey = new Map(ini.data?.initiatives.map((i) => [i.id, i]) ?? []);

  return (
    <div>
      <PageHeader
        title="Hyderabad 2027"
        lede="Unique verified visitors at HITEX, on the same ₹3 lakh as 2025. Every step above the base unlocks at a dated gate."
        actions={
          <Button
            variant="secondary"
            icon={<Ico icon={MessageSquareTextDuotone} size={18} ia="var(--lac)" ib="var(--lac-pale)" />}
            onClick={() => askCopilot('Walk me through the Hyderabad 2027 plan: which bet carries the most risk, and what is the earliest signal that tells us?')}
          >
            Ask the copilot
          </Button>
        }
      />
      <div className="grid grid-cols-12 gap-3">
        <TargetHero p={p} />
        <PlanKpis p={p} />
        <WaterfallTile p={p} />
        <BudgetTile p={p} byKey={byKey} />
        <Bets ideas={p.ideas} byKey={byKey} onAsk={askCopilot} />
        <TimelineTile p={p} />
        <TornadoTile p={p} />
        <PlanFunnelTile p={p} />
        <InputsTile p={p} />
      </div>
      {ini.error ? (
        <div className="mt-3">
          <ErrorNote onRetry={ini.refresh}>Bet status could not load: {ini.error}</ErrorNote>
        </div>
      ) : null}
    </div>
  );
}

function PlanSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading the plan">
      <Skeleton className="mb-2 h-12 w-80 bg-stone" />
      <div className="grid grid-cols-12 gap-3">
        <Skeleton className="col-span-7 h-[470px] rounded-tile-hero bg-stone max-[1200px]:col-span-12" />
        <div className="col-span-5 grid grid-cols-2 gap-3 max-[1200px]:col-span-12">
          {[0, 1, 2, 3].map((k) => (
            <Skeleton key={k} className="h-[184px] rounded-tile-s bg-stone" />
          ))}
        </div>
      </div>
    </div>
  );
}
