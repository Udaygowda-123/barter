'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema } from '@/shared/validation';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';

type Values = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { register: signUp } = useAuth(); const router = useRouter(); const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(registerSchema) });

  return (
    <>
      <h1 className="text-4xl font-black tracking-tight">Join SWAPD</h1>
      <p className="mt-2 text-muted">Free. We only ask for what we need.</p>
      <form className="mt-8 space-y-5" noValidate onSubmit={handleSubmit(async (v) => {
        setFormError(null);
        try { await signUp(v); toast.info(`We sent a verification link to ${v.email}`); router.replace('/onboarding'); }
        catch (e) {
          if (e instanceof ApiError) {
            if (e.code === 'EMAIL_TAKEN') setError('email', { message: 'An account with this email already exists' });
            else if (e.code === 'VALIDATION_FAILED') Object.entries(e.fieldErrors()).forEach(([k, m]) => setError(k as keyof Values, { message: m }));
            else setFormError(e.message);
          } else setFormError('Could not create your account. Check your connection and try again.');
        }
      })}>
        <Field label="Display name" error={errors.displayName?.message} hint="Shown on your listings and profile.">{(p) => <Input autoComplete="nickname" {...p} {...register('displayName')} />}</Field>
        <Field label="Email" error={errors.email?.message}>{(p) => <Input type="email" autoComplete="email" {...p} {...register('email')} />}</Field>
        <Field label="Password" error={errors.password?.message} hint="At least 10 characters.">{(p) => <Input type="password" autoComplete="new-password" {...p} {...register('password')} />}</Field>
        {formError && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{formError}</p>}
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>Create account</Button>
        <p className="text-center text-sm text-muted">Already swapping? <Link href="/login" className="font-semibold text-ink underline">Sign in</Link></p>
      </form>
    </>
  );
}
