import Link from 'next/link';
import { SignInForm } from '@/components/site/AuthForms';
export const metadata = { title: 'Sign in' };
export default function SignIn({ searchParams }: { searchParams: { next?: string } }) {
  return (
    <div className="wrap max-w-md py-14">
      <div className="card-pad">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mb-6 mt-1 text-sm text-ink-soft">To track orders, approve proofs and download invoices.</p>
        <SignInForm next={searchParams.next} />
        <p className="mt-5 text-center text-sm text-ink-soft">New here? <Link href={`/signup${searchParams.next ? `?next=${encodeURIComponent(searchParams.next)}` : ''}`} className="font-semibold text-leaf-700 underline">Create an account</Link></p>
      </div>
      <p className="mt-4 text-center text-xs text-ink-faint">Forgot your password? Call or WhatsApp us and we will reset it.</p>
    </div>
  );
}
