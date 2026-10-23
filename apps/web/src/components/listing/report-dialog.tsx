'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/form';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/lib/toast';

const REASONS = ['Prohibited or illegal item', 'Scam or suspicious', 'Counterfeit', 'Harassment or abuse', 'Misleading photos or description', 'Other'];

export function ReportDialog({ open, onOpenChange, targetType, targetId, subject }: { open: boolean; onOpenChange: (o: boolean) => void; targetType: 'LISTING' | 'USER' | 'MESSAGE'; targetId: string; subject: string }) {
  const [reason, setReason] = useState(REASONS[0]); const [details, setDetails] = useState(''); const [busy, setBusy] = useState(false); const toast = useToast();
  async function submit() {
    setBusy(true);
    try { await api('/reports', { method: 'POST', body: { targetType, targetId, reason, details: details || undefined } }); toast.success('Thanks — our moderators will take a look.'); onOpenChange(false); setDetails(''); }
    catch (e) { toast.error(e instanceof ApiError ? e.message : 'Could not send your report'); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`Report ${subject}`} description="Reports are reviewed by moderators. The other person is not told who reported them.">
      <fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">What&apos;s wrong?</legend>
        {REASONS.map((r) => (<label key={r} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm has-[:checked]:border-ink"><input type="radio" name="reason" className="size-4 accent-[#17151e]" checked={reason === r} onChange={() => setReason(r)} />{r}</label>))}
      </fieldset>
      <Field label="Details (optional)" className="mt-4">{(p) => <Textarea {...p} value={details} maxLength={1000} onChange={(e) => setDetails(e.target.value)} className="min-h-20" />}</Field>
      <div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button variant="danger" onClick={submit} loading={busy}>Send report</Button></div>
    </Dialog>
  );
}
void Input;
