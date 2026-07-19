import type { Metadata } from 'next';
import { Inter, Inter_Tight, JetBrains_Mono } from 'next/font/google';
import { NavLinks, NavWordmark } from './components/nav-links';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-ui-loaded' });
const interTight = Inter_Tight({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display-loaded',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono-loaded',
});

export const metadata: Metadata = {
  title: 'deTutor',
  description: 'A comprehensive German learning platform, A1 to B1, across all four skills.',
};

// Applies the stored theme and mode before hydration so first paint never
// flashes (design-system.md section 1). First visit follows the system
// color-scheme preference.
const PREHYDRATION_THEME_SCRIPT = `
(function () {
  try {
    var mode = localStorage.getItem('lid-mode');
    if (mode !== 'light' && mode !== 'dark') {
      mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.classList.add('lid-mode-' + mode);
    var theme = localStorage.getItem('lid-theme');
    if (theme === 'monochrome-stark') {
      document.documentElement.setAttribute('data-lid-theme', theme);
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREHYDRATION_THEME_SCRIPT }} />
      </head>
      <body className="antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:rounded-md focus:bg-action focus:px-4 focus:py-2 focus:text-action-inverse"
        >
          Skip to main content
        </a>
        <header className="sticky top-0 z-10 border-b border-border-default bg-surface">
          <nav
            aria-label="Main"
            className="shell-width mx-auto flex min-h-[var(--header-h)] flex-wrap items-center gap-4 px-6 text-sm"
          >
            <NavWordmark />
            <NavLinks />
          </nav>
        </header>
        <div id="main-content" tabIndex={-1} className="outline-none">
          {children}
        </div>
      </body>
    </html>
  );
}
