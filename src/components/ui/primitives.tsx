import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]', className)} {...p} />;
}

const badge = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', {
  variants: { tone: { neutral: 'bg-ink/5 text-ink', coral: 'bg-coral-soft text-coral-ink', lavender: 'bg-lavender text-lavender-ink', mint: 'bg-mint text-mint-ink', butter: 'bg-butter text-butter-ink', danger: 'bg-danger-soft text-danger', ink: 'bg-ink text-paper' } },
  defaultVariants: { tone: 'neutral' },
});
export function Badge({ tone, className, ...p }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone }), className)} {...p} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton rounded-2xl', className)} />;
}

const PALETTE = ['bg-coral-soft text-coral-ink', 'bg-lavender text-lavender-ink', 'bg-mint text-mint-ink', 'bg-butter text-butter-ink'];
export function Avatar({ name, src, size = 40, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const tone = PALETTE[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length];
  if (src) return <img src={src} alt="" width={size} height={size} className={cn('rounded-full object-cover', className)} style={{ width: size, height: size }} />;
  return (
    <span aria-hidden className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-bold', tone, className)} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </span>
  );
}

export function Chip({ active, className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button aria-pressed={active} className={cn('h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors', active ? 'border-ink bg-ink text-paper' : 'border-line bg-surface hover:border-ink', className)} {...p} />
  );
}
