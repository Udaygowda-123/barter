'use client';
import { CATEGORIES, CATEGORY_LABELS, type Category } from '@swapd/shared-types';
import { MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/form';
import { Chip } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';

const INTERESTS = ['Streetwear', 'Sneakers', 'Vintage', 'Gadgets', 'Gaming', 'Music', 'Photography', 'Books', 'Anime', 'Fitness', 'Sustainable fashion', 'Home & decor'];

export default function Onboarding() {
  const { user, status, reload } = useRequireAuth(); const router = useRouter(); const toast = useToast();
  const [step, setStep] = useState(0); const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState(''); const [interests, setInterests] = useState<string[]>([]); const [wanted, setWanted] = useState<Category[]>([]);
  const [city, setCity] = useState(''); const [region, setRegion] = useState(''); const [consent, setConsent] = useState(false); const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function finish(skip = false) {
    setSaving(true);
    try {
      await api('/users/me', { method: 'PATCH', body: skip ? { completeOnboarding: true } : {
        bio: bio || null, interests, wantedCategories: wanted, locationCity: city || null, locationRegion: region || null,
        locationConsent: consent, ...(consent && coords ? { locationLat: coords.lat, locationLng: coords.lng } : {}), completeOnboarding: true,
      } });
      await reload(); router.replace('/discover');
    } catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not save. Try again.'); } finally { setSaving(false); }
  }
  if (status !== 'authed' || !user) return <p role="status" className="text-center text-muted">Loading…</p>;

  return (
    <>
      <p className="text-sm font-bold uppercase tracking-widest text-muted">Step {step + 1} of 3</p>
      <div className="mt-2 flex gap-1.5" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-coral' : 'bg-line'}`} />)}</div>
      {step === 0 && (<div className="mt-8 space-y-5">
        <h1 className="text-4xl font-black tracking-tight">Hey {user.displayName.split(' ')[0]} 👋</h1>
        <p className="text-muted">What are you into? We use this to tune your feed. You can change it any time.</p>
        <div role="group" aria-label="Interests" className="flex flex-wrap gap-2">{INTERESTS.map((i) => <Chip key={i} active={interests.includes(i)} onClick={() => setInterests(toggle(interests, i))}>{i}</Chip>)}</div>
        <Field label="Short bio (optional)">{(p) => <Textarea {...p} maxLength={300} value={bio} onChange={(e) => setBio(e.target.value)} className="min-h-20" />}</Field>
      </div>)}
      {step === 1 && (<div className="mt-8 space-y-5">
        <h1 className="text-4xl font-black tracking-tight">What are you hoping to find?</h1>
        <p className="text-muted">Pick the categories you&apos;d love to swap into.</p>
        <div role="group" aria-label="Wanted categories" className="flex flex-wrap gap-2">{CATEGORIES.map((c) => <Chip key={c} active={wanted.includes(c)} onClick={() => setWanted(toggle(wanted, c))}>{CATEGORY_LABELS[c]}</Chip>)}</div>
      </div>)}
      {step === 2 && (<div className="mt-8 space-y-5">
        <h1 className="text-4xl font-black tracking-tight">Where are you?</h1>
        <p className="text-muted">Only your city is ever shown to others — never an address. Sharing is optional.</p>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="City">{(p) => <Input {...p} value={city} onChange={(e) => setCity(e.target.value)} autoComplete="address-level2" />}</Field><Field label="State / region">{(p) => <Input {...p} value={region} onChange={(e) => setRegion(e.target.value)} autoComplete="address-level1" />}</Field></div>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4">
          <input type="checkbox" className="mt-1 size-5 accent-[#17151e]" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span className="text-sm"><b>Use my approximate location to rank nearby items</b><br /><span className="text-muted">Stored rounded to about 10 km. You can turn this off any time.</span></span>
        </label>
        {consent && <Button type="button" variant="soft" size="sm" onClick={() => navigator.geolocation?.getCurrentPosition((p) => { setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }); toast.success('Approximate location captured'); }, () => toast.error('Location permission was denied'))}><MapPin className="size-4" aria-hidden /> {coords ? 'Update location' : 'Detect location'}</Button>}
      </div>)}
      <div className="mt-10 flex items-center justify-between">
        <Button variant="ghost" onClick={() => finish(true)} disabled={saving}>Skip for now</Button>
        <div className="flex gap-2">
          {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
          {step < 2 ? <Button onClick={() => setStep(step + 1)}>Next</Button> : <Button onClick={() => finish()} loading={saving}>Finish</Button>}
        </div>
      </div>
    </>
  );
}
