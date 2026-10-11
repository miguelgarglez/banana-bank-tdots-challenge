import type { Metadata } from 'next';
import Link from 'next/link';
import BananaMark from './components/BananaMark';

export const metadata: Metadata = { title: 'Page not found · Banana Bank' };

export default function NotFound() {
  return (
    <main className="not-found tab-enter">
      <BananaMark size={56} />
      <p className="eyebrow">Error 404</p>
      <h1>This page slipped away</h1>
      <p>
        We couldn&apos;t find what you were looking for. The link may be old or the address may have
        a typo.
      </p>
      <Link href="/" className="primary-button">
        Back to home
      </Link>
    </main>
  );
}
