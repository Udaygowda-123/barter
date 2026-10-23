'use client';
import { CheckCircle2, Info, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { cn } from './utils';

type Kind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: Kind; text: string }
const Ctx = createContext<(kind: Kind, text: string) => void>(() => undefined);
/** Stable identity across renders, so it is safe in effect dependency lists. */
export const useToast = () => {
  const push = useContext(Ctx);
  return useMemo(() => ({ success: (t: string) => push('success', t), error: (t: string) => push('error', t), info: (t: string) => push('info', t) }), [push]);
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);
  const Icon = { success: CheckCircle2, error: XCircle, info: Info };
  return (
    <Ctx.Provider value={push}>
      {children}
      {/* Live region so screen readers announce results of actions */}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map((t) => {
          const I = Icon[t.kind];
          return (
            <div key={t.id} className={cn('pointer-events-auto flex max-w-md items-start gap-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-[var(--shadow-pop)]',
              t.kind === 'success' && 'bg-mint text-mint-ink', t.kind === 'error' && 'bg-danger-soft text-danger', t.kind === 'info' && 'bg-ink text-paper')}>
              <I className="mt-0.5 size-4 shrink-0" aria-hidden /> <span>{t.text}</span>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
