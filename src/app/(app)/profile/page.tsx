'use client';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@/shared/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProfileHeader, UserListings, UserReviews } from '@/components/profile/profile-view';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Chip } from '@/components/ui/primitives';
import { Spinner } from '@/components/ui/states';
import { api, ApiError } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { prepareImage } from '@/lib/image';
import { useToast } from '@/lib/toast';
import type { ImageDto, PublicProfile } from '@/lib/types';

export default function MyProfile() {
  const { user, status, reload, logout } = useRequireAuth(); const router = useRouter(); const qc = useQueryClient(); const toast = useToast();
  const [tab, setTab] = useState<'listings' | 'reviews'>('listings'); const [edit, setEdit] = useState(false); const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ displayName: '', bio: '', city: '', region: '', wanted: [] as Category[], consent: false, avatarUrl: '' });
  const q = useQuery({ queryKey: ['profile', user?.id], queryFn: () => api<PublicProfile>(`/users/${user!.id}`), enabled: !!user });
  useEffect(() => { if (user && edit) setF({ displayName: user.displayName, bio: user.bio ?? '', city: user.locationCity ?? '', region: user.locationRegion ?? '', wanted: user.preference?.wantedCategories ?? [], consent: user.preference?.locationConsent ?? false, avatarUrl: user.avatarUrl ?? '' }); }, [edit, user]);
  if (status !== 'authed' || !user || !q.data) return <Spinner />;

  async function save() {
    setBusy(true);
    try {
      await api('/users/me', { method: 'PATCH', body: { displayName: f.displayName, bio: f.bio || null, locationCity: f.city || null, locationRegion: f.region || null, wantedCategories: f.wanted, locationConsent: f.consent, avatarUrl: f.avatarUrl || null } });
      await reload(); qc.invalidateQueries({ queryKey: ['profile'] }); toast.success('Profile updated'); setEdit(false);
    } catch (e) { toast.error(e instanceof ApiError ? (e.fieldErrors()[Object.keys(e.fieldErrors())[0]] ?? e.message) : 'Could not save'); } finally { setBusy(false); }
  }
  async function avatar(file?: File) {
    if (!file) return; const fd = new FormData(); fd.append('file', await prepareImage(file));
    try { const img = await api<ImageDto>('/media/images', { method: 'POST', body: fd }); setF((s) => ({ ...s, avatarUrl: img.thumbUrl ?? img.url })); } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Upload failed'); }
  }

  return (
    <div className="space-y-8">
      <ProfileHeader p={q.data} actions={<><Button variant="outline" size="sm" onClick={() => setEdit(true)}><Pencil className="size-4" aria-hidden />Edit</Button><Button variant="ghost" size="sm" onClick={async () => { await logout(); router.push('/'); }}><LogOut className="size-4" aria-hidden />Sign out</Button></>} />
      <div className="flex items-center justify-between"><div role="tablist" aria-label="Profile sections" className="flex gap-2"><Chip role="tab" aria-selected={tab === 'listings'} active={tab === 'listings'} onClick={() => setTab('listings')}>My listings</Chip><Chip role="tab" aria-selected={tab === 'reviews'} active={tab === 'reviews'} onClick={() => setTab('reviews')}>Reviews</Chip></div><Button asChild size="sm"><Link href="/listing/new"><Plus className="size-4" aria-hidden />List an item</Link></Button></div>
      {tab === 'listings' ? <UserListings userId={user.id} own /> : <UserReviews userId={user.id} />}

      <Dialog open={edit} onOpenChange={setEdit} title="Edit profile">
        <div className="space-y-4">
          <div className="flex items-center gap-4">{f.avatarUrl ? <img src={f.avatarUrl} alt="Your avatar" className="size-16 rounded-full object-cover" /> : <span className="flex size-16 items-center justify-center rounded-full bg-lavender text-2xl font-bold text-lavender-ink" aria-hidden>{f.displayName[0]}</span>}
            <label className="cursor-pointer rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold hover:border-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-ink">Change photo<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => avatar(e.target.files?.[0])} /></label>{f.avatarUrl && <Button variant="ghost" size="sm" onClick={() => setF({ ...f, avatarUrl: '' })}>Remove</Button>}</div>
          <Field label="Display name">{(p) => <Input {...p} value={f.displayName} maxLength={40} onChange={(e) => setF({ ...f, displayName: e.target.value })} />}</Field>
          <Field label="Bio">{(p) => <Textarea {...p} value={f.bio} maxLength={300} onChange={(e) => setF({ ...f, bio: e.target.value })} className="min-h-20" />}</Field>
          <div className="grid grid-cols-2 gap-3"><Field label="City">{(p) => <Input {...p} value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />}</Field><Field label="State / region">{(p) => <Input {...p} value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} />}</Field></div>
          <div><p id="wc" className="mb-2 text-sm font-semibold">Categories you want</p><div role="group" aria-labelledby="wc" className="flex flex-wrap gap-2">{CATEGORIES.map((c) => <Chip key={c} type="button" active={f.wanted.includes(c)} onClick={() => setF({ ...f, wanted: f.wanted.includes(c) ? f.wanted.filter((x) => x !== c) : [...f.wanted, c] })}>{CATEGORY_LABELS[c]}</Chip>)}</div></div>
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-3 text-sm"><input type="checkbox" className="mt-0.5 size-5 accent-[#17151e]" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} /><span><b>Use approximate location for ranking</b><br /><span className="text-muted">Turning this off deletes stored coordinates.</span></span></label>
          <div className="flex justify-end gap-2 pt-2"><Button variant="ghost" onClick={() => setEdit(false)}>Cancel</Button><Button onClick={save} loading={busy} disabled={f.displayName.trim().length < 2}>Save</Button></div>
        </div>
      </Dialog>
    </div>
  );
}
