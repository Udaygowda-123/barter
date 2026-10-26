import Link from 'next/link';
import { Hero } from '@/components/landing-hero';
import Sections from '@/components/landing-sections';
import { LandingNav } from '@/components/landing/landing-nav';
import { Logo } from '@/components/logo';

export default function Landing() {
  return (
    <>
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:h-20 md:px-8">
          <Logo className="text-paper" />
          <LandingNav />
        </div>
      </header>
      <main id="main"><Hero /><Sections /></main>
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-10 text-sm text-muted md:px-8">
        <Logo className="text-ink" />
        <p className="max-w-xl">SWAPD does not transfer money, hold funds in escrow, or guarantee item values. Estimated values are set by owners and are not appraisals. Demo photos: Wikimedia Commons contributors, open licences (credits in the repo).</p>
        <nav aria-label="Footer" className="flex gap-4"><Link href="/discover" className="underline">Browse</Link><Link href="/login" className="underline">Sign in</Link></nav>
      </footer>
    </>
  );
}
