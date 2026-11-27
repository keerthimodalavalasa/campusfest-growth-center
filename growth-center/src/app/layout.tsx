import type { Metadata, Viewport } from 'next';
import { Mona_Sans } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { AppStateProvider } from '@/lib/app-state';
import { AppShell } from '@/components/shell/AppShell';

// One family, two ways: words at wdth 100, poster-condensed numerals at wdth 75 (see the `num` utility).
// latin-ext carries the rupee sign.
const mona = Mona_Sans({
  variable: '--font-mona',
  subsets: ['latin', 'latin-ext'],
  axes: ['wdth'],
  display: 'swap',
});

const NAME = 'CampusFest Growth Center';
const DESCRIPTION =
  'Attendee growth for CampusFest Hyderabad 2027: funnel analytics, scale/change/stop decisions, campaign and task management, and an AI copilot grounded in the 2025 data.';

// Absolute URLs for the share image: the production domain on Vercel, localhost otherwise.
const SITE = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000';

// Icons and the share image come from the file conventions in this folder:
// icon.svg, favicon.ico, apple-icon.png, opengraph-image.png (+ alt text) and manifest.ts.
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: NAME, template: `%s | ${NAME}` },
  description: DESCRIPTION,
  applicationName: NAME,
  authors: [{ name: 'Modalavalasa Keerthi' }],
  keywords: ['CampusFest', 'Hyderabad', 'attendee growth', 'growth dashboard', 'campaign analytics', 'AI copilot', 'RISA Labs'],
  openGraph: { type: 'website', siteName: NAME, title: NAME, description: DESCRIPTION, locale: 'en_IN', url: '/' },
  twitter: { card: 'summary_large_image', title: NAME, description: DESCRIPTION },
  appleWebApp: { title: 'Growth Center', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  colorScheme: 'light',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${mona.variable} antialiased`}>
      <body>
        <AppStateProvider>
          <AppShell>{children}</AppShell>
        </AppStateProvider>
        <Toaster position="bottom-left" richColors closeButton />
      </body>
    </html>
  );
}
