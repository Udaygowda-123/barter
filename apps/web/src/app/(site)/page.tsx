import Link from 'next/link';
import { Categories, HowItWorks, Hero, SwapShowcase, Trust } from '@/components/landing';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';

export default function Landing() {
  return (
    <>
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 md:px-8">
          <Logo />
          <nav aria-label="Account" className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"><Link href="/discover">Browse</Link></Button>
            <Button asChild variant="ghost" size="sm"><Link href="/login">Sign in</Link></Button>
            <Button asChild size="sm"><Link href="/register">Join free</Link></Button>
          </nav>
        </div>
      </header>
      <main id="main"><div className="pt-16"><Hero /></div><HowItWorks /><SwapShowcase /><Categories /><Trust /></main>
      <footer className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-10 text-sm text-muted md:px-8">
        <Logo className="text-ink" />
        <p className="max-w-xl">SWAPD does not transfer money, hold funds in escrow, or guarantee item values. Estimated values are set by owners and are not appraisals. Demo photos: Wikimedia Commons contributors, open licences (credits in the repo).</p>
        <nav aria-label="Footer" className="flex gap-4"><Link href="/discover" className="underline">Browse</Link><Link href="/login" className="underline">Sign in</Link></nav>
      </footer>
    </>
  );
}
