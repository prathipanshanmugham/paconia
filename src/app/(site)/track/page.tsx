import Link from 'next/link';
import { TrackForm } from '@/components/site/PublicForms';
export const metadata = { title: 'Track an order' };
export default function Track() {
  return (
    <div className="wrap max-w-2xl py-14">
      <h1 className="text-3xl font-bold">Track an order</h1>
      <p className="mb-6 mt-2 text-ink-soft">Enter the order number from your confirmation and the mobile number on the order. <Link href="/signin?next=/account" className="underline">Sign in</Link> to see proofs and invoices.</p>
      <div className="card-pad"><TrackForm /></div>
    </div>
  );
}
