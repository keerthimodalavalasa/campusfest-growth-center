import type { Metadata } from 'next';
import { ctx } from '@/server/api';
import { CampaignDetailPage } from '../_components/CampaignDetail';

/** The tab shows the campaign's name; if the data can't be read, fall back to its id. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const name = await ctx()
    .then(({ ds }) => ds.campaigns.find((c) => c.campaignId === id)?.name)
    .catch(() => undefined);
  const label = name ?? `Campaign ${id}`;
  // absolute: the Campaigns layout sets a plain title, which does not pass the root's "%s | ..." template down
  return {
    title: { absolute: `${label} | CampusFest Growth Center` },
    description: `${label}: spend, funnel, cost per visitor, the current call and its tasks.`,
  };
}

/**
 * The page is a client component (CampaignDetailPage) that reads its id with useParams() inside Suspense.
 * The shared app shell reads usePathname() outside Suspense, which on a dynamic route is request-time
 * URL data, so this route is allowed to block (Cache Components `instant = false`).
 */
export const instant = false;

export default function Page() {
  return <CampaignDetailPage />;
}
