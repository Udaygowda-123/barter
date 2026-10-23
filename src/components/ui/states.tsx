import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';
import { Illustration, type ArtName } from './illustration';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return <div role="status" className="flex items-center justify-center gap-2 py-10 text-muted"><Loader2 className="size-5 animate-spin" aria-hidden /><span className="text-sm">{label}…</span></div>;
}

export function EmptyState({ icon, art, title, body, action, className }: { icon?: React.ReactNode; art?: ArtName; title: string; body?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line bg-surface/60 px-6 py-14 text-center', className)}>
      {art ? <Illustration name={art} className="mb-3 h-24 w-32" /> : icon && <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-lavender text-lavender-ink">{icon}</div>}
      <h3 className="font-display text-xl font-bold">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message = 'We could not load this.', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-[var(--radius-card)] border border-danger/20 bg-danger-soft/60 px-6 py-10 text-center">
      <AlertTriangle className="mb-3 size-8 text-danger" aria-hidden />
      <p className="font-semibold text-danger">{message}</p>
      {onRetry && <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
