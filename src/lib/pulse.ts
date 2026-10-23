import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';

export interface Pulse { unreadNotifications: number; unreadConversations: number; newestNotification: { id: string; type: string; read: boolean } | null }

/** One tiny request (~100 B) feeds the nav badges and toast detection. Pauses in hidden tabs; shared via the query cache. */
export function usePulse() {
  const { status } = useAuth();
  return useQuery({ queryKey: ['pulse'], queryFn: () => api<Pulse>('/pulse'), enabled: status === 'authed', refetchInterval: 15_000, staleTime: 5_000 });
}
