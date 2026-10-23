'use client';
import { useQuery } from '@tanstack/react-query';
import { Ban, Flag } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { ReportDialog } from '@/components/listing/report-dialog';
import { ProfileHeader, UserListings, UserReviews } from '@/components/profile/profile-view';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/primitives';
import { EmptyState, ErrorState } from '@/components/ui/states';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import type { PublicProfile } from '@/lib/types';

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>(); const { user, status } = useAuth(); const toast = useToast();
  const q = useQuery({ queryKey: ['profile', id], queryFn: () => api<PublicProfile>(`/users/${id}`), retry: false });
  const [report, setReport] = useState(false); const [blocking, setBlocking] = useState(false);
  if (q.isLoading) return <Skeleton className="h-48" />;
  if (q.error instanceof ApiError && q.error.status === 404) return <EmptyState title="Profile not found" action={<Button asChild><Link href="/discover">Back to discover</Link></Button>} />;
  if (q.isError || !q.data) return <ErrorState onRetry={() => q.refetch()} />;
  const me = user?.id === id; const authed = status === 'authed';
  return (
    <div className="space-y-10">
      <ProfileHeader p={q.data} actions={me ? <Button asChild variant="outline"><Link href="/profile">Edit profile</Link></Button> : authed ? (<><Button variant="outline" size="sm" onClick={() => setReport(true)}><Flag className="size-4" aria-hidden />Report</Button><Button variant="outline" size="sm" onClick={() => setBlocking(true)}><Ban className="size-4" aria-hidden />Block</Button></>) : undefined} />
      <section aria-labelledby="l"><h2 id="l" className="mb-5 text-2xl font-black">Listings</h2><UserListings userId={id} own={me} /></section>
      <section aria-labelledby="r"><h2 id="r" className="mb-5 text-2xl font-black">Reviews</h2><UserReviews userId={id} /></section>
      <ReportDialog open={report} onOpenChange={setReport} targetType="USER" targetId={id} subject={q.data.displayName} />
      <Dialog open={blocking} onOpenChange={setBlocking} title={`Block ${q.data.displayName}?`} description="You won't see each other's listings, and neither of you can message or make offers to the other."><div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setBlocking(false)}>Cancel</Button><Button variant="danger" onClick={async () => { try { await api(`/users/${id}/block`, { method: 'POST' }); toast.success('User blocked'); setBlocking(false); } catch { toast.error('Could not block this user'); } }}>Block</Button></div></Dialog>
    </div>
  );
}
