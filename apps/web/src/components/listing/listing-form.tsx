'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { CATEGORIES, CATEGORY_LABELS, CONDITIONS, CONDITION_LABELS, type CashFlexibility, type Category } from '@swapd/shared-types';
import { createListingSchema } from '@swapd/validation';
import { useQueryClient } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Chip } from '@/components/ui/primitives';
import { api, ApiError } from '@/lib/api';
import { formatINR } from '@/lib/format';
import { useToast } from '@/lib/toast';
import type { ImageDto, Listing } from '@/lib/types';
import { ImageUploader } from './image-uploader';
import { ListingCard } from './listing-card';

const formSchema = createListingSchema.omit({ imageIds: true, coverImageId: true });
type Values = z.input<typeof formSchema>;
const CASH: Record<CashFlexibility, string> = { NONE: 'Straight swap only', WILL_ADD: 'I can add cash', WILL_ACCEPT: 'I\'d accept cash on top', EITHER: 'Open to cash either way' };

export function ListingForm({ listing }: { listing?: Listing }) {
  const router = useRouter(); const toast = useToast(); const qc = useQueryClient();
  const [images, setImages] = useState<ImageDto[]>(listing?.images ?? []); const [coverId, setCoverId] = useState<string | null>(listing?.images.find((i) => i.isCover)?.id ?? null);
  const [imgError, setImgError] = useState<string | null>(null); const [preview, setPreview] = useState<Values | null>(null); const [busy, setBusy] = useState(false);
  const onImages = useCallback((i: ImageDto[], c: string | null) => { setImages(i); setCoverId(c); setImgError(null); }, []);

  const { register, control, handleSubmit, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(formSchema),
    defaultValues: listing ? { title: listing.title, description: listing.description, category: listing.category, condition: listing.condition, estimatedValue: listing.estimatedValue, wantedText: listing.wantedText ?? '', wantedCategories: listing.wantedCategories, cashFlexibility: listing.cashFlexibility, exchangeMethods: listing.exchangeMethods } : { category: 'OTHER', condition: 'GOOD', cashFlexibility: 'NONE', exchangeMethods: ['LOCAL_HANDOVER'], wantedCategories: [] },
  });

  function review(v: Values) { if (!images.length) { setImgError('Add at least one photo'); return; } setPreview(v); }

  async function publish() {
    if (!preview) return; setBusy(true);
    const body = { ...preview, estimatedValue: preview.estimatedValue || null, wantedText: preview.wantedText || null, imageIds: images.map((i) => i.id), coverImageId: coverId ?? undefined };
    try {
      const saved = await api<Listing>(listing ? `/listings/${listing.id}` : '/listings', { method: listing ? 'PATCH' : 'POST', body });
      toast.success(listing ? 'Listing updated' : 'Your item is live 🎉'); qc.invalidateQueries(); router.replace(`/listing/${saved.id}`);
    } catch (e) {
      setPreview(null);
      if (e instanceof ApiError && e.code === 'VALIDATION_FAILED') Object.entries(e.fieldErrors()).forEach(([k, m]) => (k === 'imageIds' ? setImgError(m) : setError(k as keyof Values, { message: m })));
      else toast.error(e instanceof ApiError ? e.message : 'Could not save your listing. Try again.');
    } finally { setBusy(false); }
  }

  const previewListing: Listing | null = preview ? {
    id: 'preview', ownerId: '', title: preview.title, description: preview.description, category: preview.category, condition: preview.condition, estimatedValue: preview.estimatedValue || null, currency: 'INR', wantedText: preview.wantedText ?? null,
    wantedCategories: preview.wantedCategories ?? [], cashFlexibility: preview.cashFlexibility ?? 'NONE', exchangeMethods: preview.exchangeMethods, locationCity: listing?.locationCity ?? null, locationRegion: null, status: 'ACTIVE', isSeedData: false, createdAt: new Date().toISOString(),
    images: images.map((i, n) => ({ ...i, isCover: i.id === coverId, position: n })), isOwner: true, owner: { id: '', displayName: 'You', avatarUrl: null, locationCity: null, locationRegion: null, verified: false },
  } : null;

  return (
    <form onSubmit={handleSubmit(review, () => { if (!images.length) setImgError('Add at least one photo'); })} noValidate className="space-y-10">
      <section aria-labelledby="photos"><h2 id="photos" className="text-xl font-black">Photos</h2><p className="mb-4 mt-1 text-sm text-muted">Natural light and a clean background work best. The first photo (or the one marked Cover) is shown in the feed.</p>
        <ImageUploader images={images} coverId={coverId} onChange={onImages} />{imgError && <p role="alert" className="mt-2 text-sm font-medium text-danger">{imgError}</p>}</section>

      <section aria-labelledby="details" className="space-y-5"><h2 id="details" className="text-xl font-black">Details</h2>
        <Field label="Title" error={errors.title?.message}>{(p) => <Input {...p} maxLength={80} placeholder="e.g. Retro running sneakers, UK 9" {...register('title')} />}</Field>
        <Field label="Description" error={errors.description?.message} hint="Be honest about flaws — it builds trust and avoids disputes.">{(p) => <Textarea {...p} maxLength={2000} {...register('description')} />}</Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Category" error={errors.category?.message}>{(p) => <Select {...p} {...register('category')}>{CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}</Select>}</Field>
          <Field label="Condition" error={errors.condition?.message}>{(p) => <Select {...p} {...register('condition')}>{CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}</Select>}</Field>
        </div>
        <Field label="Estimated value (₹, optional)" error={errors.estimatedValue?.message} hint="Your own estimate to help others judge a fair swap — it isn't an appraisal.">{(p) => <Input {...p} type="number" min={0} inputMode="numeric" {...register('estimatedValue', { setValueAs: (v) => (v === '' || v == null ? null : Number(v)) })} />}</Field>
      </section>

      <section aria-labelledby="swap" className="space-y-5"><h2 id="swap" className="text-xl font-black">What would you swap for?</h2>
        <Field label="Looking for" error={errors.wantedText?.message} hint="Free text, e.g. “wireless headphones, or a handheld console”.">{(p) => <Input {...p} maxLength={300} {...register('wantedText')} />}</Field>
        <Controller control={control} name="wantedCategories" render={({ field }) => (
          <div><p className="mb-2 text-sm font-semibold" id="wc">Categories you&apos;d be happy to receive</p><div role="group" aria-labelledby="wc" className="flex flex-wrap gap-2">{CATEGORIES.map((c) => { const on = (field.value ?? []).includes(c as Category); return <Chip key={c} type="button" active={on} onClick={() => field.onChange(on ? (field.value ?? []).filter((x) => x !== c) : [...(field.value ?? []), c])}>{CATEGORY_LABELS[c]}</Chip>; })}</div></div>
        )} />
        <Field label="Cash difference" error={errors.cashFlexibility?.message}>{(p) => <Select {...p} {...register('cashFlexibility')}>{(Object.keys(CASH) as CashFlexibility[]).map((k) => <option key={k} value={k}>{CASH[k]}</option>)}</Select>}</Field>
        <fieldset><legend className="mb-2 text-sm font-semibold">Exchange methods</legend>
          <Controller control={control} name="exchangeMethods" render={({ field }) => (<div className="flex flex-wrap gap-3">{(['LOCAL_HANDOVER', 'SHIPPING'] as const).map((m) => { const on = field.value?.includes(m); return (
            <label key={m} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-medium has-[:checked]:border-ink"><input type="checkbox" className="size-4 accent-[#17151e]" checked={!!on} onChange={() => field.onChange(on ? field.value.filter((x) => x !== m) : [...(field.value ?? []), m])} />{m === 'SHIPPING' ? 'Shipping' : 'Local meet-up'}</label>); })}</div>)} />
          {errors.exchangeMethods && <p role="alert" className="mt-2 text-sm font-medium text-danger">{errors.exchangeMethods.message ?? 'Pick at least one'}</p>}
        </fieldset>
      </section>

      <div className="flex items-center justify-end gap-3 border-t border-line pt-6"><Button type="button" variant="ghost" onClick={() => router.back()}>Cancel</Button><Button type="submit" size="lg"><Eye className="size-5" aria-hidden />Preview &amp; {listing ? 'save' : 'publish'}</Button></div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)} title="Preview" description="This is how your listing will look in the feed." className="md:max-w-md">
        {previewListing && <div className="pointer-events-none mx-auto max-w-[260px]" aria-hidden={false}><ListingCard listing={previewListing} /></div>}
        <dl className="mt-4 space-y-1 text-sm"><div className="flex justify-between"><dt className="text-muted">Estimated value</dt><dd className="font-semibold">{formatINR(preview?.estimatedValue || null)}</dd></div><div className="flex justify-between"><dt className="text-muted">Photos</dt><dd className="font-semibold">{images.length}{images.some((i) => i.aiEdited) ? ' (some AI-enhanced)' : ''}</dd></div></dl>
        <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setPreview(null)}>Keep editing</Button><Button onClick={publish} loading={busy}>{listing ? 'Save changes' : 'Publish listing'}</Button></div>
      </Dialog>
    </form>
  );
}
