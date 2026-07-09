import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'German Tutor',
  description: 'A comprehensive German learning platform, A1 to B1, across all four skills.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <nav
          aria-label="Main"
          className="mx-auto flex max-w-2xl flex-wrap gap-4 border-b px-8 py-3 text-sm"
        >
          <Link href="/today" data-testid="nav-today">
            Today
          </Link>
          <Link href="/practice" data-testid="nav-practice">
            Practice
          </Link>
          <Link href="/progress" data-testid="nav-progress">
            Progress
          </Link>
          <Link href="/settings" data-testid="nav-settings">
            Settings
          </Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
