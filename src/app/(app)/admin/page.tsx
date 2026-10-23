'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/form';
import { Badge, Card, Chip, Skeleton } from '@/components/ui/primitives';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/states';
import { api, ApiError } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';
import { useToast } from '@/lib/toast';

interface Report { id: string; targetType: 'LISTING' | 'USER' | 'MESSAGE'; targetId: string; reason: string; details: string | null; createdAt: string; reporter: { displayName: string } }
type Tab = 'reports' | 'held' | 'terms' | 'audit';

export default function Admin() {
  const { user, status } = useRequireAuth(); const qc = useQueryClient(); const toast = useToast();
  const [tab, setTab] = useState<Tab>('reports'); const [term, setTerm] = useState('');
  const isStaff = user?.role === 'ADMIN' || user?.role === 'MODERATOR'; const isAdmin = user?.role === 'ADMIN';
  const enabled = status === 'authed' && isStaff;
  const reports = useQuery({ queryKey: ['admin', 'reports'], queryFn: () => api<Report[]>('/admin/reports'), enabled: enabled && tab === 'reports' });
  const held = useQuery({ queryKey: ['admin', 'held'], queryFn: () => api<{ id: string; title: string; updatedAt: string }[]>('/admin/listings/held'), enabled: enabled && tab === 'held' });
  const terms = useQuery({ queryKey: ['admin', 'terms'], queryFn: () => api<{ id: string; term: string }[]>('/admin/prohibited-terms'), enabled: enabled && isAdmin && tab === 'terms' });
  const audit = useQuery({ queryKey: ['admin', 'audit'], queryFn: () => api<{ id: string; action: string; targetType: string | null; targetId: string | null; createdAt: string; actor: { displayName: string } | null }[]>('/admin/audit-logs'), enabled: enabled && isAdmin && tab === 'audit' });
  const call = useMutation({
    mutationFn: ({ path, body, method = 'POST' }: { path: string; body?: object; method?: string }) => api(path, { method, body: method === 'DELETE' ? undefined : body ?? {} }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin'] }); toast.success('Done'); },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Action failed'),
  });

  if (status !== 'authed') return <Spinner />;
  if (!isStaff) return <EmptyState icon={<Shield className="size-7" aria-hidden />} title="Moderators only" body="You don't have access to this area." action={<Button asChild><Link href="/discover">Back to discover</Link></Button>} />;
  const tabs: [Tab, string][] = [['reports', 'Reports'], ['held', 'Held listings'], ...(isAdmin ? [['terms', 'Prohibited terms'], ['audit', 'Audit log']] as [Tab, string][] : [])];
  const resolve = (id: string, action: string) => call.mutate({ path: `/admin/reports/${id}/resolve`, body: { action } });

  return (
    <div className="mx-auto max-w-4xl"><h1 className="text-3xl font-black tracking-tight md:text-5xl">Moderation</h1><p className="mt-1 text-muted">Every action here is recorded in the audit log.</p>
      <div role="tablist" aria-label="Moderation sections" className="mt-6 flex flex-wrap gap-2">{tabs.map(([id, label]) => <Chip key={id} role="tab" aria-selected={tab === id} active={tab === id} onClick={() => setTab(id)}>{label}</Chip>)}</div>
      <div className="mt-6 space-y-3">
        {tab === 'reports' && (reports.isPending ? <Skeleton className="h-32" /> : reports.isError ? <ErrorState onRetry={() => reports.refetch()} /> : !reports.data!.length ? <EmptyState title="Queue is clear" body="No open reports." /> : reports.data!.map((r) => (
          <Card key={r.id} className="p-5"><div className="flex flex-wrap items-center gap-2"><Badge tone="danger">{r.targetType.toLowerCase()}</Badge><span className="font-bold">{r.reason}</span><span className="text-xs text-muted">by {r.reporter.displayName} · {timeAgo(r.createdAt)}</span></div>
            {r.details && <p className="mt-2 text-sm">{r.details}</p>}
            <p className="mt-2 text-sm">{r.targetType === 'LISTING' ? <Link className="font-semibold underline" href={`/listing/${r.targetId}`}>View listing</Link> : r.targetType === 'USER' ? <Link className="font-semibold underline" href={`/u/${r.targetId}`}>View profile</Link> : <span className="text-muted">Message {r.targetId}</span>}</p>
            <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => resolve(r.id, 'DISMISS')}>Dismiss</Button><Button size="sm" variant="outline" onClick={() => resolve(r.id, 'RESOLVE')}>Mark resolved</Button>{r.targetType === 'LISTING' && <Button size="sm" variant="danger" onClick={() => resolve(r.id, 'REMOVE_LISTING')}>Remove listing</Button>}<Button size="sm" variant="outline" onClick={() => resolve(r.id, 'RESTRICT_USER')}>Restrict user</Button>{isAdmin && <Button size="sm" variant="danger" onClick={() => resolve(r.id, 'SUSPEND_USER')}>Suspend user</Button>}</div></Card>)))}
        {tab === 'held' && (held.isPending ? <Skeleton className="h-24" /> : held.isError ? <ErrorState onRetry={() => held.refetch()} /> : !held.data!.length ? <EmptyState title="Nothing on hold" /> : held.data!.map((l) => <Card key={l.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><Link href={`/listing/${l.id}`} className="font-bold underline">{l.title}</Link><div className="flex gap-2"><Button size="sm" onClick={() => call.mutate({ path: `/admin/listings/${l.id}/restore` })}>Restore</Button><Button size="sm" variant="danger" onClick={() => call.mutate({ path: `/admin/listings/${l.id}/remove` })}>Remove</Button></div></Card>))}
        {tab === 'terms' && (<><form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (term.trim().length > 1) { call.mutate({ path: '/admin/prohibited-terms', body: { term } }); setTerm(''); } }}><Input aria-label="New prohibited term" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Add a prohibited term…" /><Button type="submit">Add</Button></form>
          {terms.isPending ? <Skeleton className="h-24" /> : terms.isError ? <ErrorState onRetry={() => terms.refetch()} /> : <ul className="flex flex-wrap gap-2">{terms.data!.map((t) => <li key={t.id} className="flex items-center gap-1 rounded-full bg-surface py-1 pl-4 pr-1 text-sm font-semibold ring-1 ring-line">{t.term}<button aria-label={`Remove ${t.term}`} onClick={() => call.mutate({ path: `/admin/prohibited-terms/${t.id}`, method: 'DELETE' })} className="flex size-7 items-center justify-center rounded-full hover:bg-danger-soft">×</button></li>)}</ul>}</>)}
        {tab === 'audit' && (audit.isPending ? <Skeleton className="h-40" /> : audit.isError ? <ErrorState onRetry={() => audit.refetch()} /> : <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">{audit.data!.map((a) => <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><span><b>{a.actor?.displayName ?? 'System'}</b> · <code className="rounded bg-ink/5 px-1.5 py-0.5 text-xs">{a.action}</code> {a.targetType && <span className="text-muted">{a.targetType} {a.targetId?.slice(0, 8)}</span>}</span><span className="text-xs text-muted">{timeAgo(a.createdAt)}</span></li>)}</ul>)}
      </div></div>
  );
}
