'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Main navigation (owner-directed 2026-07-10): wordmark plus five links, the
// active page marked by ink weight AND an underline (never color alone).
// Theme and mode controls live in Settings now, not here.

const LINKS = [
  { href: '/today', label: 'Today', testId: 'nav-today' },
  { href: '/learn', label: 'Learn', testId: 'nav-learn' },
  { href: '/practice', label: 'Practice', testId: 'nav-practice' },
  { href: '/progress', label: 'Progress', testId: 'nav-progress' },
  { href: '/settings', label: 'Settings', testId: 'nav-settings' },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={
              active
                ? 'font-medium text-ink underline decoration-2 underline-offset-8'
                : 'text-ink-muted hover:text-ink'
            }
            data-testid={link.testId}
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
