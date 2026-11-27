import { CampaignDetailPage } from '../_components/CampaignDetail';

/**
 * The page is a client component (CampaignDetailPage) that reads its id with useParams() inside Suspense.
 * The shared app shell reads usePathname() outside Suspense, which on a dynamic route is request-time
 * URL data, so this route is allowed to block (Cache Components `instant = false`).
 */
export const instant = false;

export default function Page() {
  return <CampaignDetailPage />;
}
