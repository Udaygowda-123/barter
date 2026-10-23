'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function Verify() {
  const token = useSearchParams().get('token') ?? ''; const { status, reload } = useAuth(); const ran = useRef(false);
  const [state, setState] = useState<'working' | 'ok' | 'error'>('working'); const [msg, setMsg] = useState('');
  useEffect(() => {
    if (ran.current) return; ran.current = true; // one-time token: guard against React strict-mode double run
    if (!token) { setState('error'); setMsg('This verification link is incomplete.'); return; }
    api('/auth/verify-email', { method: 'POST', body: { token } })
      .then(() => { setState('ok'); void reload(); })
      .catch((e) => { setState('error'); setMsg(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'); });
  }, [token, reload]);
  if (state === 'working') return <p role="status" className="text-center text-muted">Verifying your email…</p>;
  if (state === 'ok') return <div role="status"><h1 className="text-4xl font-black tracking-tight">Email verified ✓</h1><p className="mt-3 text-muted">Thanks — your profile now shows a verified badge.</p><Button asChild className="mt-6"><Link href={status === 'authed' ? '/discover' : '/login'}>{status === 'authed' ? 'Start swapping' : 'Sign in'}</Link></Button></div>;
  return <div role="alert"><h1 className="text-4xl font-black tracking-tight">Link problem</h1><p className="mt-3 text-muted">{msg}</p><p className="mt-2 text-sm text-muted">Sign in and use “Resend” in the banner to get a fresh link.</p><Button asChild variant="outline" className="mt-6"><Link href="/login">Go to sign in</Link></Button></div>;
}
export default function Page() { return <Suspense><Verify /></Suspense>; }
