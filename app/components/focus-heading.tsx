'use client';

import { useEffect, useRef, type ReactNode } from 'react';

// Focus management for swapped views (a11y audit 2026-07-10): when a step,
// phase, or card replaces the previous one inside a page, keyboard and
// screen-reader users need their focus carried to the new content. Mount
// this as the new view's heading (key it by step/word/phase) and focus
// lands there, announcing the change.

export function FocusHeading({
  children,
  className,
  'data-testid': testId,
}: {
  children: ReactNode;
  className?: string;
  'data-testid'?: string;
}) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <h2
      ref={ref}
      tabIndex={-1}
      className={`font-display text-xl font-semibold outline-none ${className ?? ''}`}
      data-testid={testId}
    >
      {children}
    </h2>
  );
}
