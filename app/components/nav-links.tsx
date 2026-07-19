'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Main navigation (owner-directed 2026-07-10, reorganized GT-D4): the
// wordmark is the home link, then the four daily learning surfaces, with
// Settings pushed to the far side as account rather than curriculum. The
// active page is marked by ink weight AND an underline (never color alone).
// Theme and mode controls live in Settings, not here.

// Where the wordmark goes. Deliberately /today rather than /: the site root
// is the onboarding route, so pointing home at it walked placed learners
// back into the placement flow.
const HOME_HREF = '/today';

const LEARNING_LINKS = [
  { href: '/today', label: 'Today', testId: 'nav-today' },
  { href: '/learn', label: 'Learn', testId: 'nav-learn' },
  { href: '/practice', label: 'Practice', testId: 'nav-practice' },
  { href: '/progress', label: 'Progress', testId: 'nav-progress' },
] as const;

const ACCOUNT_LINKS = [{ href: '/settings', label: 'Settings', testId: 'nav-settings' }] as const;

function useIsActive(): (href: string) => boolean {
  const pathname = usePathname();
  return (href) => pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  label,
  testId,
  active,
}: {
  href: string;
  label: string;
  testId: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={
        active
          ? 'font-medium text-ink underline decoration-2 underline-offset-8'
          : 'text-ink-muted hover:text-ink'
      }
      data-testid={testId}
    >
      {label}
    </Link>
  );
}

export function NavWordmark() {
  return (
    <Link
      href={HOME_HREF}
      className="font-display text-base font-semibold tracking-tight text-ink"
      data-testid="nav-home"
    >
      deTutor
    </Link>
  );
}

export function NavLinks() {
  const isActive = useIsActive();
  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        {LEARNING_LINKS.map((link) => (
          <NavLink key={link.href} {...link} active={isActive(link.href)} />
        ))}
      </div>
      {/* Account sits opposite the learning surfaces on wide viewports and
          simply follows them once the bar wraps on narrow ones. */}
      <div className="flex items-center gap-4 sm:ml-auto">
        {ACCOUNT_LINKS.map((link) => (
          <NavLink key={link.href} {...link} active={isActive(link.href)} />
        ))}
      </div>
    </>
  );
}
