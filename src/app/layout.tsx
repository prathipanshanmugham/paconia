import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/figtree';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: 'Paconia · Labels, boxes, pouches and print in short runs', template: '%s · Paconia' },
  description: 'Custom labels, stickers, product boxes, printed pouches, cards and laser-cut pieces, printed in Perundurai, Erode. See your price instantly and approve a proof before we print.',
  openGraph: { siteName: 'Paconia', locale: 'en_IN', type: 'website' },
};
export const viewport: Viewport = { themeColor: '#F6F7F4', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
