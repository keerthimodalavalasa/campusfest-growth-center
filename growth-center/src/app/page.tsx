'use client';
import type { Diagnosis } from '@/server/engine/diagnose';
import type { DecisionBoard } from '@/server/engine/decide';
import type { EventDays } from '@/server/engine/eventday';
import { useApi } from '@/lib/api';
import { useApp, useAsOfUrl } from '@/lib/app-state';
import { ErrorNote, Skeleton } from '@/components/ui';
import { makeCtx, type Overview } from './_overview/model';
import { Attainment, GateTile, HeroTile } from './_overview/HeroTiles';
import { FunnelTile, SignalsTiles } from './_overview/FunnelSignals';
import { PaceTile, WeeklyTile } from './_overview/PaceWeekly';
import { Scoreboard } from './_overview/Scoreboard';

/**
 * Overview: the Charminar Bento. Every tile leads with a visual and one numeral; each metric family owns one hue
 * (visitors lac, registrations nizami, money haldi, audience pista). Works at any as-of date on the tape, in three
 * modes: campaign (projected, assumptions hatched), event (gates open) and after the event.
 */
export default function OverviewPage() {
  const { meta } = useApp();
  const ov = useApi<Overview>(useAsOfUrl('/api/overview'));
  const gate = useApi<EventDays>(useAsOfUrl('/api/eventday'));
  const camps = useApi<{ decisions: DecisionBoard }>(useAsOfUrl('/api/campaigns'));
  const diag = useApi<Diagnosis>(useAsOfUrl('/api/diagnose'));

  if (ov.error) return <ErrorNote onRetry={ov.refresh}>Could not load the overview: {ov.error}</ErrorNote>;
  if (!ov.data) return <OverviewSkeleton />;

  const c = makeCtx(ov.data.snapshot);

  return (
    <>
      <h1 className="sr-only">Overview: how the campaign is tracking</h1>
      <div className="bento">
        <HeroTile c={c} />
        <Attainment c={c} prev={ov.data.previous} />
        <GateTile c={c} gate={gate.data} />
        <FunnelTile c={c} />
        <SignalsTiles c={c} diag={diag.data} />
        <PaceTile c={c} daily={ov.data.daily} latestDate={meta?.latestDate ?? c.asOf} />
        <WeeklyTile weekly={ov.data.weekly} campaigns={ov.data.snapshot.campaigns} />
        <Scoreboard c={c} decisions={camps.data?.decisions ?? null} />
      </div>
      {diag.error || camps.error || gate.error ? (
        <div className="mt-3">
          <ErrorNote
            onRetry={() => {
              diag.refresh();
              camps.refresh();
              gate.refresh();
            }}
          >
            Some tiles could not load: {diag.error ?? camps.error ?? gate.error}
          </ErrorNote>
        </div>
      ) : null}
    </>
  );
}

function OverviewSkeleton() {
  const areas: [string, string][] = [
    ['hero', 'min-h-[470px] rounded-tile-hero'],
    ['gate', 'min-h-[300px]'],
    ['fun', 'min-h-[360px]'],
    ['sig', 'min-h-[360px]'],
    ['pace', 'min-h-[380px]'],
    ['week', 'min-h-[380px]'],
    ['score', 'min-h-[260px]'],
  ];
  return (
    <div className="bento" aria-busy="true" aria-label="Loading the overview">
      <div data-area="att" className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((k) => (
          <Skeleton key={k} className="min-h-[200px] rounded-tile-s bg-stone" />
        ))}
      </div>
      {areas.map(([area, cls]) => (
        <div key={area} data-area={area}>
          <Skeleton className={`h-full rounded-tile-l bg-stone ${cls}`} />
        </div>
      ))}
    </div>
  );
}
