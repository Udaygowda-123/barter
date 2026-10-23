import Link from 'next/link';
import { Logo } from '@/components/logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh md:grid-cols-[1fr_1.1fr]">
      <div className="relative hidden overflow-hidden bg-lavender p-12 md:flex md:flex-col md:justify-between">
        <Logo />
        <div>
          <p className="max-w-md text-5xl font-black leading-[1.05] tracking-tight">Your next favorite thing is already out there.</p>
          <p className="mt-5 max-w-sm text-lavender-ink">Swap what you have for what you actually want — with clear terms, real chat, and both-sides confirmation.</p>
        </div>
        <div aria-hidden className="absolute -bottom-24 -right-16 size-80 rounded-full bg-coral/30 blur-3xl" />
        <p className="text-sm text-lavender-ink">Free while we grow. No payments handled by SWAPD.</p>
      </div>
      <main id="main" className="flex flex-col px-5 py-8 md:px-14 md:py-12">
        <div className="mb-8 md:hidden"><Logo /></div>
        <div className="m-auto w-full max-w-md">{children}</div>
        <p className="mt-10 text-center text-xs text-muted"><Link href="/" className="underline">Back to home</Link></p>
      </main>
    </div>
  );
}
