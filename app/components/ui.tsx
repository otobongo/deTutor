import Link from 'next/link';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

// Shared UI primitives (owner-directed 2026-07-10): every action in the app
// speaks one visual language. Variants map to the token layer only; accents
// come from the existing palette and never carry meaning alone
// (docs/design-standards-appendix.md documents the rules).

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'md' | 'sm';

// 44px minimum touch target at md; sm is for dense inline contexts only.
const SIZE_CLASSES: Readonly<Record<ButtonSize, string>> = {
  md: 'min-h-11 px-4 py-2 text-sm',
  sm: 'min-h-9 px-3 py-1.5 text-sm',
};

const VARIANT_CLASSES: Readonly<Record<ButtonVariant, string>> = {
  primary:
    'bg-action text-action-inverse border border-transparent hover:opacity-90 disabled:opacity-40',
  secondary:
    'bg-surface text-ink border border-border-default hover:bg-surface-2 hover:border-border-strong disabled:opacity-40',
  ghost:
    'bg-transparent text-ink-muted border border-transparent hover:bg-surface-2 hover:text-ink disabled:opacity-40',
};

function buttonClasses(variant: ButtonVariant, size: ButtonSize, extra?: string): string {
  return [
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors duration-[var(--motion-fast)]',
    SIZE_CLASSES[size],
    VARIANT_CLASSES[variant],
    extra ?? '',
  ]
    .join(' ')
    .trim();
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

// Navigation that sits in an action row: semantically a link, visually a
// button. Plain prose links stay plain links.
export function ButtonLink({
  href,
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...props
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  'data-testid'?: string;
}) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

// The standard in-flow action row: primary first (left), secondary beside,
// wraps cleanly on narrow screens. One per view wherever possible.
export function ActionRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-3 ${className ?? ''}`}>{children}</div>;
}

// Progress with a sparing accent: the gold highlight from the palette for
// learning progress, neutral ink for everything else. The percentage always
// also appears as text near the bar (color never alone).
export function ProgressBar({
  percent,
  label,
  tone = 'accent',
}: {
  percent: number;
  label: string;
  tone?: 'accent' | 'neutral';
}) {
  const bounded = Math.max(0, Math.min(100, percent));
  return (
    <span
      className="block h-2 w-full overflow-hidden rounded-pill bg-surface-2"
      role="progressbar"
      aria-valuenow={bounded}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <span
        className="block h-full rounded-pill"
        style={{
          width: `${bounded}%`,
          background: tone === 'accent' ? 'var(--highlight-date-color)' : 'var(--color-action)',
        }}
      />
    </span>
  );
}

// A selectable pill (word chips, answer toggles, tiles): exposes its state
// through aria-pressed, never through color alone. 44px touch height.
export function Chip({
  selected = false,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={[
        'inline-flex min-h-11 items-center gap-1 rounded-pill border px-3 py-1 text-sm transition-colors duration-[var(--motion-fast)] disabled:opacity-40',
        selected
          ? 'border-border-strong bg-action text-action-inverse'
          : 'border-border-default bg-surface hover:bg-surface-2',
        className ?? '',
      ]
        .join(' ')
        .trim()}
      {...props}
    />
  );
}

// A small status chip: done states get the success tint, active/graded
// states the gold tint, everything else neutral. Text carries the meaning.
export function StatusChip({
  children,
  tone = 'neutral',
  'data-testid': testId,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'accent';
  'data-testid'?: string;
}) {
  const toneClasses =
    tone === 'success'
      ? 'bg-[var(--color-success-tint)] text-[var(--color-success)]'
      : tone === 'accent'
        ? 'bg-[var(--highlight-date-color)] text-[var(--highlight-date-text-color)]'
        : 'bg-surface-2 text-ink-muted';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium ${toneClasses}`}
      data-testid={testId}
    >
      {children}
    </span>
  );
}
