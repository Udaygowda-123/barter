'use client';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import { AuthProvider, useAuth } from './auth';
import { ToastProvider, useToast } from './toast';
import type { NotificationDto, Page } from './types';

const TEXT: Record<string, string> = {
  OFFER_RECEIVED: 'You have a new offer', OFFER_COUNTERED: 'You received a counteroffer', OFFER_ACCEPTED: 'Your offer was accepted 🎉',
  OFFER_REJECTED: 'An offer was declined', OFFER_WITHDRAWN: 'An offer was withdrawn', OFFER_EXPIRED: 'An offer expired',
  DEAL_UPDATED: 'A deal was updated', REVIEW_RECEIVED: 'You received a review', MODERATION: 'Moderation update',
};

/** Serverless-friendly "live" updates: while the tab is visible, poll notifications and refresh dependent data. */
function Poller() {
  const { status } = useAuth(); const qc = useQueryClient(); const toast = useToast(); const seen = useRef<string | null>(null);
  useEffect(() => {
    if (status !== 'authed') { seen.current = null; return; }
    let stop = false;
    const tick = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const r = await api<Page<NotificationDto> & { unreadCount: number }>('/notifications');
        qc.setQueryData(['notifications'], r);
        const newest = r.items[0]?.id ?? null;
        if (seen.current !== null && newest && newest !== seen.current) {
          for (const n of r.items) { if (n.id === seen.current) break; if (!n.readAt && n.type !== 'MESSAGE' && TEXT[n.type]) toast.info(TEXT[n.type]); }
          for (const k of ['offers', 'offer', 'deals', 'deal']) qc.invalidateQueries({ queryKey: [k] });
        }
        seen.current = newest ?? seen.current ?? '';
      } catch { /* offline or signed out: try again next tick */ }
    };
    tick(); const t = setInterval(() => !stop && tick(), 10_000);
    return () => { stop = true; clearInterval(t); };
  }, [status, qc, toast]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: true, retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2 } },
  }));
  return (
    <QueryClientProvider client={qc}>
      <MotionConfig reducedMotion="user">
        <ToastProvider><AuthProvider><Poller />{children}</AuthProvider></ToastProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
