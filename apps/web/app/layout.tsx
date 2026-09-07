import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Hybrid Emotional Engine',
  description: 'Foundation workspace for modeling estimated emotional states.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
