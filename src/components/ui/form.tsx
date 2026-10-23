import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

const base = 'w-full rounded-[var(--radius-control)] border bg-surface px-4 text-base text-ink md:text-[15px] placeholder:text-muted/70 transition-colors focus-visible:border-ink disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(({ className, invalid, ...p }, ref) => (
  <input ref={ref} aria-invalid={invalid || undefined} className={cn(base, 'h-12', invalid ? 'border-danger' : 'border-line', className)} {...p} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(({ className, invalid, ...p }, ref) => (
  <textarea ref={ref} aria-invalid={invalid || undefined} className={cn(base, 'min-h-28 py-3', invalid ? 'border-danger' : 'border-line', className)} {...p} />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(({ className, invalid, ...p }, ref) => (
  <select ref={ref} aria-invalid={invalid || undefined} className={cn(base, 'h-12 appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2366627a%27 stroke-width=%272.5%27><path d=%27m6 9 6 6 6-6%27/></svg>")] bg-[length:16px] bg-[right_1rem_center] bg-no-repeat pr-10', invalid ? 'border-danger' : 'border-line', className)} {...p} />
));
Select.displayName = 'Select';

/** Label + control + hint/error wired together for assistive tech. */
export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; className?: string; children: (props: { id: string; 'aria-describedby'?: string; invalid: boolean }) => React.ReactNode }) {
  const id = useId(); const descId = `${id}-d`;
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
      {children({ id, 'aria-describedby': error || hint ? descId : undefined, invalid: !!error })}
      {(error || hint) && <p id={descId} role={error ? 'alert' : undefined} className={cn('text-[13px]', error ? 'font-medium text-danger' : 'text-muted')}>{error ?? hint}</p>}
    </div>
  );
}
