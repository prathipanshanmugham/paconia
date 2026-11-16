import Link from 'next/link';
import { SignUpForm } from '@/components/site/AuthForms';
export const metadata = { title: 'Create an account' };
export default function SignUp({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <div className="wrap max-w-lg py-14">
      <div className="card-pad">
        <h1 className="text-2xl font-bold">Create your account</h1>
        <p className="mb-6 mt-1 text-sm text-ink-soft">One account for all your orders, proofs and GST invoices.</p>
        <SignUpForm next={searchParams.next} />
        <p className="mt-5 text-center text-sm text-ink-soft">Already have an account? <Link href={`/signin${searchParams.next ? `?next=${encodeURIComponent(searchParams.next)}` : ''}`} className="font-semibold text-leaf-700 underline">Sign in</Link></p>
      </div>
    </div>
  );
}
