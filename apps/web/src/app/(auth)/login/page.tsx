'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@swapd/validation';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type Values = z.infer<typeof loginSchema>;

function LoginForm() {
  const { login } = useAuth(); const router = useRouter(); const next = useSearchParams().get('next');
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(loginSchema) });

  return (
    <>
      <h1 className="text-4xl font-black tracking-tight">Welcome back</h1>
      <p className="mt-2 text-muted">Sign in to see your offers and messages.</p>
      <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit(async (v) => {
        setFormError(null);
        try { const me = await login(v.email, v.password); router.replace(next && next.startsWith('/') ? next : me.preference?.onboardedAt ? '/discover' : '/onboarding'); }
        catch (e) { setFormError(e instanceof ApiError ? e.message : 'Could not sign in. Check your connection and try again.'); }
      })}>
        <Field label="Email" error={errors.email?.message}>{(p) => <Input type="email" autoComplete="email" {...p} {...register('email')} />}</Field>
        <Field label="Password" error={errors.password?.message}>{(p) => <Input type="password" autoComplete="current-password" {...p} {...register('password')} />}</Field>
        {formError && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{formError}</p>}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Sign in</Button>
        <div className="flex justify-between text-sm"><Link href="/forgot-password" className="font-semibold underline">Forgot password?</Link><Link href="/register" className="font-semibold underline">Create account</Link></div>
      </form>
      <p className="mt-8 rounded-2xl bg-lavender/60 p-4 text-sm text-lavender-ink">Trying the demo? Seed accounts like <b>maya@swapd.demo</b> use the password <b>swapd-demo-pass</b> (local development only).</p>
    </>
  );
}
export default function Page() { return <Suspense><LoginForm /></Suspense>; }
