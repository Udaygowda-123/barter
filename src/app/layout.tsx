import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { Bricolage_Grotesque, Instrument_Serif } from 'next/font/google';
import { Providers } from '@/lib/providers';
import './globals.css';

// Display face for headlines, an italic serif for editorial accents; Geist stays the readable UI/body face.
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', display: 'swap', weight: ['500', '700', '800'] });
const serif = Instrument_Serif({ subsets: ['latin'], variable: '--font-instrument', display: 'swap', weight: '400', style: 'italic' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000'),
  title: { default: 'SWAPD — Your next favourite thing is already out there', template: '%s · SWAPD' },
  description: "Discover things you love. Trade things you don't. A free peer-to-peer swapping marketplace with clear offers, honest photos and both-sides confirmation.",
};
export const viewport: Viewport = { themeColor: '#FAF8F5', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${display.variable} ${serif.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper">Skip to content</a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
