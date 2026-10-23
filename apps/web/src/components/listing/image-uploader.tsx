'use client';
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Sparkles, Star, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { api, ApiError } from '@/lib/api';
import { prepareImage } from '@/lib/image';
import { useToast } from '@/lib/toast';
import type { ImageDto } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Props { images: ImageDto[]; coverId: string | null; onChange: (images: ImageDto[], coverId: string | null) => void; max?: number }

/** Upload → server re-encodes + strips metadata → enhanced preview arrives asynchronously. The user chooses which version to publish. */
export function ImageUploader({ images, coverId, onChange, max = 8 }: Props) {
  const toast = useToast(); const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const state = useRef({ images, coverId }); state.current = { images, coverId };

  // Poll images that are still processing.
  useEffect(() => {
    const pending = images.filter((i) => i.status === 'PROCESSING' || i.status === 'PENDING');
    if (!pending.length) return;
    const t = setInterval(async () => {
      const fresh = await Promise.all(pending.map((p) => api<ImageDto>(`/media/images/${p.id}`).catch(() => p)));
      const map = new Map(fresh.map((f) => [f.id, f]));
      onChange(state.current.images.map((i) => map.get(i.id) ?? i), state.current.coverId);
    }, 1000);
    return () => clearInterval(t);
  }, [images, onChange]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = max - images.length;
    if (room <= 0) return toast.error(`You can add up to ${max} photos`);
    const picked = [...files].slice(0, room);
    let list = [...state.current.images]; let cover = state.current.coverId;
    for (const f of picked) {
      if (f.size > 25 * 1024 * 1024) { toast.error(`${f.name} is over 25 MB`); continue; }
      setUploading((n) => n + 1);
      try {
        const fd = new FormData(); fd.append('file', await prepareImage(f));
        const img = await api<ImageDto>('/media/images', { method: 'POST', body: fd });
        list = [...list, img]; cover ??= img.id; onChange(list, cover);
      } catch (e) { toast.error(e instanceof ApiError ? `${f.name}: ${e.message}` : `Could not upload ${f.name}`); }
      finally { setUploading((n) => n - 1); }
    }
    if (input.current) input.current.value = '';
  }

  async function choose(img: ImageDto, useEnhanced: boolean) {
    try { const updated = await api<ImageDto>(`/media/images/${img.id}`, { method: 'PATCH', body: { useEnhanced } }); onChange(images.map((i) => (i.id === img.id ? updated : i)), coverId); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not switch version'); }
  }
  async function remove(img: ImageDto) {
    const rest = images.filter((i) => i.id !== img.id);
    onChange(rest, coverId === img.id ? (rest[0]?.id ?? null) : coverId);
    api(`/media/images/${img.id}`, { method: 'DELETE' }).catch(() => undefined); // attached images are simply dropped on save
  }
  const move = (i: number, d: -1 | 1) => { const a = [...images]; [a[i], a[i + d]] = [a[i + d], a[i]]; onChange(a, coverId); };

  return (
    <div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {images.map((img, i) => (
          <li key={img.id} className={cn('overflow-hidden rounded-2xl border-2 bg-surface', coverId === img.id ? 'border-ink' : 'border-line')}>
            <div className="relative aspect-[4/5] bg-ink/5">
              <img src={img.url} alt={`Photo ${i + 1}${img.aiEdited ? ' (AI-enhanced)' : ''}`} className="size-full object-cover" />
              {(img.status === 'PROCESSING' || img.status === 'PENDING') && <span className="absolute inset-x-2 bottom-2 flex items-center gap-1.5 rounded-full bg-paper/95 px-3 py-1 text-xs font-semibold"><Loader2 className="size-3 animate-spin" aria-hidden />Enhancing…</span>}
              {coverId === img.id && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-paper"><Star className="size-3" aria-hidden />Cover</span>}
            </div>
            <div className="space-y-2 p-2.5">
              {img.status === 'FAILED' && <p className="text-xs text-muted">{img.error ?? 'Enhancement unavailable'}</p>}
              {img.enhancedUrl && (
                <div role="radiogroup" aria-label={`Version of photo ${i + 1}`} className="grid grid-cols-2 gap-1 rounded-full bg-ink/5 p-0.5 text-xs font-semibold">
                  <button role="radio" aria-checked={!img.useEnhanced} onClick={() => choose(img, false)} className={cn('h-8 rounded-full', !img.useEnhanced && 'bg-surface shadow')}>Original</button>
                  <button role="radio" aria-checked={img.useEnhanced} onClick={() => choose(img, true)} className={cn('flex h-8 items-center justify-center gap-1 rounded-full', img.useEnhanced && 'bg-lavender text-lavender-ink shadow')}><Sparkles className="size-3" aria-hidden />Enhanced</button>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2" disabled={coverId === img.id} onClick={() => onChange(images, img.id)}>Make cover</Button>
                <div className="flex">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move photo ${i + 1} earlier`} className="flex size-8 items-center justify-center rounded-full hover:bg-ink/5 disabled:opacity-30"><ArrowUp className="size-4" aria-hidden /></button>
                  <button type="button" disabled={i === images.length - 1} onClick={() => move(i, 1)} aria-label={`Move photo ${i + 1} later`} className="flex size-8 items-center justify-center rounded-full hover:bg-ink/5 disabled:opacity-30"><ArrowDown className="size-4" aria-hidden /></button>
                  <button type="button" onClick={() => remove(img)} aria-label={`Remove photo ${i + 1}`} className="flex size-8 items-center justify-center rounded-full text-danger hover:bg-danger-soft"><Trash2 className="size-4" aria-hidden /></button>
                </div>
              </div>
            </div>
          </li>
        ))}
        {images.length < max && (
          <li><button type="button" onClick={() => input.current?.click()} className="flex aspect-[4/5] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line bg-surface/60 text-sm font-semibold text-muted transition-colors hover:border-ink hover:text-ink">
            {uploading > 0 ? <Loader2 className="size-7 animate-spin" aria-hidden /> : <ImagePlus className="size-7" aria-hidden />}{uploading > 0 ? 'Uploading…' : 'Add photos'}<span className="text-xs font-normal">JPEG, PNG or WebP</span>
          </button></li>
        )}
      </ul>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" aria-label="Upload photos" onChange={(e) => addFiles(e.target.files)} />
      <p className="mt-3 flex items-start gap-2 text-xs text-muted"><Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden /><span>Enhancement balances light and colour and frames your photo — it never hides scratches, damage or serial numbers. We keep your original on file, and enhanced photos are labelled &quot;AI-enhanced&quot; to buyers.</span></p>
    </div>
  );
}
