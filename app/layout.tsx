import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Homework Hub',
  description: 'A simple homework tracker for students',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}