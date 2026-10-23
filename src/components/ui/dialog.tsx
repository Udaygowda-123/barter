'use client';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Radix Dialog: focus trap, Escape to close, restores focus, labelled by its title. */
export function Dialog({ open, onOpenChange, title, description, children, className }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-[2px]" />
        <D.Content className={cn('fixed inset-x-0 bottom-0 z-50 max-h-[92dvh] overflow-y-auto rounded-t-[2rem] bg-paper p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6 shadow-[var(--shadow-pop)] md:inset-auto md:left-1/2 md:top-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[2rem]', className)}>
          <div className="mb-4 flex items-start justify-between gap-4">
            <div><D.Title className="text-xl font-bold">{title}</D.Title>{description && <D.Description className="mt-1 text-sm text-muted">{description}</D.Description>}</div>
            <D.Close className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-ink/5" aria-label="Close"><X className="size-5" aria-hidden /></D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
