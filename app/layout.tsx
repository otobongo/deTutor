import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'German Tutor',
  description: 'A comprehensive German learning platform, A1 to B1, across all four skills.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
