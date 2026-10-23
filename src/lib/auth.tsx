'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, consumeSessionUser, refreshSession, setToken } from './api';
import type { Me } from './types';

interface AuthCtx {
  user: Me | null; status: 'loading' | 'authed' | 'anon';
  login(email: string, password: string): Promise<Me>; register(input: { email: string; password: string; displayName: string }): Promise<Me>;
  logout(): Promise<void>; reload(): Promise<Me | null>;
}
const Ctx = createContext<AuthCtx | null>(null);

const FLAG = 'swapd:session';
/** A hint (not a credential) that this browser has signed in before, so anonymous visitors skip the refresh call. */
const hint = {
  has: () => { try { return localStorage.getItem(FLAG) === '1'; } catch { return true; } },
  set: () => { try { localStorage.setItem(FLAG, '1'); } catch { /* storage unavailable */ } },
  clear: () => { try { localStorage.removeItem(FLAG); } catch { /* storage unavailable */ } },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [status, setStatus] = useState<AuthCtx['status']>('loading');
  const qc = useQueryClient();

  const reload = useCallback(async () => {
    try { const me = await api<Me>('/users/me'); setUser(me); setStatus('authed'); return me; }
    catch { setUser(null); setStatus('anon'); return null; }
  }, []);

  useEffect(() => {
    (async () => { if (!hint.has()) { setStatus('anon'); return; } const t = await refreshSession(); if (!t) { hint.clear(); setStatus('anon'); return; } const me = consumeSessionUser<Me>(); if (me) { setUser(me); setStatus('authed'); } else await reload(); })();
  }, [reload]);

  const value = useMemo<AuthCtx>(() => ({
    user, status, reload,
    async login(email, password) {
      const r = await api<{ accessToken: string; me: Me }>('/auth/login', { method: 'POST', body: { email, password } });
      setToken(r.accessToken); hint.set(); setUser(r.me); setStatus('authed'); return r.me;
    },
    async register(input) {
      const r = await api<{ accessToken: string; me: Me }>('/auth/register', { method: 'POST', body: input });
      setToken(r.accessToken); hint.set(); setUser(r.me); setStatus('authed'); return r.me;
    },
    async logout() {
      await api('/auth/logout', { method: 'POST', body: {} }).catch(() => undefined);
      setToken(null); hint.clear(); setUser(null); setStatus('anon'); qc.clear();
    },
  }), [user, status, reload, qc]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}

/** Redirects anonymous visitors to /login and returns the user once known. */
export function useRequireAuth() {
  const auth = useAuth(); const router = useRouter();
  useEffect(() => {
    if (auth.status === 'anon') router.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [auth.status, router]);
  return auth;
}
