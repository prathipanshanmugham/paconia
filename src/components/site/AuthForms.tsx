'use client';
import ActionForm from '@/components/FormMessage';
import SubmitButton from '@/components/SubmitButton';
import { signIn, signUp } from '@/app/actions/auth';

export function SignInForm({ next }: { next?: string }) {
  return (
    <ActionForm action={signIn} className="space-y-4">
      <input type="hidden" name="next" value={next || ''} />
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required className="input" /></div>
      <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="current-password" required className="input" /></div>
      <SubmitButton className="btn-primary w-full" pendingText="Signing in…">Sign in</SubmitButton>
    </ActionForm>
  );
}

export function SignUpForm({ next }: { next?: string }) {
  return (
    <ActionForm action={signUp} className="space-y-4">
      <input type="hidden" name="next" value={next || ''} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="label" htmlFor="name">Your name</label><input id="name" name="name" autoComplete="name" required className="input" /></div>
        <div><label className="label" htmlFor="phone">Mobile</label><input id="phone" name="phone" type="tel" autoComplete="tel" required className="input" placeholder="98xxx xxxxx" /></div>
      </div>
      <div><label className="label" htmlFor="company">Business name <span className="font-normal text-ink-faint">(optional)</span></label><input id="company" name="company" autoComplete="organization" className="input" /></div>
      <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required className="input" /></div>
      <div><label className="label" htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required className="input" /><p className="hint">At least 8 characters.</p></div>
      <SubmitButton className="btn-primary w-full" pendingText="Creating account…">Create account</SubmitButton>
    </ActionForm>
  );
}
