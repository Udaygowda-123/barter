'use client';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from './api';
import { AuthProvider } from './auth';
import { usePulse } from './pulse';
import { ToastProvider, useToast } from './toast';

const TEXT: Record<string, string> = {
  OFFER_RECEIVED: 'You have a new offer', OFFER_COUNTERED: 'You received a counteroffer', OFFER_ACCEPTED: 'Your offer was accepted 🎉',
  OFFER_REJECTED: 'An offer was declined', OFFER_WITHDRAWN: 'An offer was withdrawn', OFFER_EXPIRED: 'An offer expired',
  DEAL_UPDATED: 'A deal was updated', REVIEW_RECEIVED: 'You received a review', MODERATION: 'Moderation update',
};

/** Serverless "live" updates: react to changes in the pulse (toast + refresh only the data that could have changed). */
function PulseEffects() {
  const { data } = usePulse(); const qc = useQueryClient(); const toast = useToast(); const prev = useRef<{ nid?: string; convs?: number }>({});
  useEffect(() => {
    if (!data) return;
    const p = prev.current; const n = data.newestNotification;
    if (p.nid !== undefined && n && n.id !== p.nid && !n.read) {
      if (n.type !== 'MESSAGE' && TEXT[n.type]) toast.info(TEXT[n.type]);
      for (const k of ['offers', 'offer', 'deals', 'deal', 'notifications']) qc.invalidateQueries({ queryKey: [k] });
    }
    if (p.convs !== undefined && data.unreadConversations !== p.convs) { qc.invalidateQueries({ queryKey: ['conversations'] }); qc.invalidateQueries({ queryKey: ['messages'] }); }
    prev.current = { nid: n?.id ?? '', convs: data.unreadConversations };
  }, [data, qc, toast]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, gcTime: 10 * 60_000, refetchOnWindowFocus: false, retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 2 } },
  }));
  return <QueryClientProvider client={qc}><ToastProvider><AuthProvider><PulseEffects />{children}</AuthProvider></ToastProvider></QueryClientProvider>;
}
