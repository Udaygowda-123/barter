import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const buttonStyles = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition-[background,transform,box-shadow] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-coral text-ink hover:bg-coral-hover shadow-[0_6px_18px_-8px_rgb(255_118_94/0.9)]',
        ink: 'bg-ink text-paper hover:bg-ink-soft on-ink',
        soft: 'bg-lavender text-lavender-ink hover:bg-[#eadbff]',
        outline: 'border border-line bg-surface text-ink hover:border-ink',
        ghost: 'text-ink hover:bg-ink/5',
        danger: 'bg-danger text-white hover:bg-[#8f1c12]',
      },
      size: { sm: 'h-9 px-4 text-sm', md: 'h-11 px-5 text-sm', lg: 'h-14 px-8 text-base', icon: 'size-11' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonStyles> { asChild?: boolean; loading?: boolean }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, loading, children, disabled, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button';
  return (
    <Comp ref={ref} className={cn(buttonStyles({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {asChild ? children : <>{loading && <Loader2 className="size-4 animate-spin" aria-hidden />}{children}</>}
    </Comp>
  );
});
Button.displayName = 'Button';
