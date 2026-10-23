'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { forgotPasswordSchema } from '@/shared/validation';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { api } from '@/lib/api';

export default function ForgotPage() {
  const [sent, setSent] = useState(false); const [err, setErr] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof forgotPasswordSchema>>({ resolver: zodResolver(forgotPasswordSchema) });
  if (sent) return (
    <div role="status"><h1 className="text-4xl font-black tracking-tight">Check your email</h1>
      <p className="mt-3 text-muted">If an account exists for that address, a reset link is on its way. The link expires in an hour.</p>
      <p className="mt-2 text-sm text-muted">Nothing arrived? Check spam, or wait a minute and request again (limit: 3 per hour).</p>
      <Button asChild variant="outline" className="mt-6"><Link href="/login">Back to sign in</Link></Button></div>
  );
  return (
    <>
      <h1 className="text-4xl font-black tracking-tight">Reset your password</h1>
      <p className="mt-2 text-muted">Enter your email and we&apos;ll send you a link.</p>
      <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit(async (v) => { setErr(null); try { await api('/auth/forgot-password', { method: 'POST', body: v }); setSent(true); } catch { setErr('Something went wrong. Please try again.'); } })}>
        <Field label="Email" error={errors.email?.message}>{(p) => <Input type="email" autoComplete="email" {...p} {...register('email')} />}</Field>
        {err && <p role="alert" className="text-sm font-medium text-danger">{err}</p>}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Send reset link</Button>
        <p className="text-center text-sm"><Link href="/login" className="font-semibold underline">Back to sign in</Link></p>
      </form>
    </>
  );
}
