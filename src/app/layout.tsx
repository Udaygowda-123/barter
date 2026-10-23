import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { Providers } from '@/lib/providers';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000'),
  title: { default: 'SWAPD — Your next favorite thing is already out there', template: '%s · SWAPD' },
  description: 'Swap what you have for what you actually want. Discover items, make structured offers, negotiate, and complete swaps with trust.',
};
export const viewport: Viewport = { themeColor: '#FAF8F5', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper">Skip to content</a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
