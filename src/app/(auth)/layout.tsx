import Link from 'next/link';
import { Logo } from '@/components/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh md:grid-cols-[1fr_1.1fr]">
      <div className="on-ink relative hidden overflow-hidden bg-night p-12 text-paper md:flex md:flex-col md:justify-between">
        <img src="/video/hero-poster.webp" alt="" aria-hidden className="absolute inset-0 size-full object-cover opacity-60" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-night via-night/40 to-night/30" />
        <Logo className="relative" />
        <div className="relative">
          <p className="max-w-md text-5xl font-extrabold leading-[1.02] font-display">Your next <em className="accent font-normal text-violet">favourite</em> thing is already out there.</p>
          <p className="mt-5 max-w-sm text-paper/80">Swap what you have for what you actually want — with clear terms, real chat, and both-sides confirmation.</p>
        </div>
        <p className="relative text-sm text-paper/70">Free to use. No payments handled by SWAPD.</p>
      </div>
      <main id="main" className="flex flex-col px-5 py-8 md:px-14 md:py-12">
        <div className="mb-8 md:hidden"><Logo /></div>
        <div className="m-auto w-full max-w-md">{children}</div>
        <p className="mt-10 text-center text-xs text-muted"><Link href="/" className="inline-block px-2 py-3 underline">Back to home</Link></p>
      </main>
    </div>
  );
}
