'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema } from '@/shared/validation';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { api, ApiError } from '@/lib/api';

function Form() {
  const token = useSearchParams().get('token') ?? '';
  const [done, setDone] = useState(false); const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof resetPasswordSchema>>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { token } });
  if (done) return <div role="status"><h1 className="text-4xl font-black tracking-tight">Password updated</h1><p className="mt-3 text-muted">You can now sign in with your new password.</p><Button asChild className="mt-6"><Link href="/login">Sign in</Link></Button></div>;
  return (
    <>
      <h1 className="text-4xl font-black tracking-tight">Choose a new password</h1>
      <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit(async (v) => { setErr(null); try { await api('/auth/reset-password', { method: 'POST', body: v }); setDone(true); } catch (e) { setErr(e instanceof ApiError ? e.message : 'Something went wrong.'); } })}>
        <input type="hidden" {...register('token')} />
        <Field label="New password" error={errors.password?.message ?? errors.token?.message} hint="At least 10 characters.">{(p) => <Input type="password" autoComplete="new-password" {...p} {...register('password')} />}</Field>
        {err && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{err}</p>}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Update password</Button>
      </form>
    </>
  );
}
export default function Page() { return <Suspense><Form /></Suspense>; }
