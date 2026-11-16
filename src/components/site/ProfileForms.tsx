'use client';
import ActionForm from '@/components/FormMessage';
import SubmitButton from '@/components/SubmitButton';
import { updateProfile } from '@/app/actions/account';
import { changePassword } from '@/app/actions/auth';

type P = { name: string; phone: string; company: string; gstin: string; line1: string; line2: string; city: string; pincode: string };

export function ProfileForm({ p }: { p: P }) {
  return (
    <ActionForm action={updateProfile} className="grid gap-4 sm:grid-cols-2">
      <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" defaultValue={p.name} required className="input" /></div>
      <div><label className="label" htmlFor="phone">Mobile</label><input id="phone" name="phone" type="tel" defaultValue={p.phone} required className="input" /></div>
      <div><label className="label" htmlFor="company">Business name</label><input id="company" name="company" defaultValue={p.company} className="input" /></div>
      <div><label className="label" htmlFor="gstin">GSTIN</label><input id="gstin" name="gstin" defaultValue={p.gstin} maxLength={15} className="input uppercase" /></div>
      <div className="sm:col-span-2"><label className="label" htmlFor="line1">Address</label><input id="line1" name="line1" defaultValue={p.line1} className="input" /></div>
      <div className="sm:col-span-2"><input name="line2" defaultValue={p.line2} className="input" aria-label="Address line 2" placeholder="Area, landmark" /></div>
      <div><label className="label" htmlFor="city">City</label><input id="city" name="city" defaultValue={p.city} className="input" /></div>
      <div><label className="label" htmlFor="pincode">Pincode</label><input id="pincode" name="pincode" defaultValue={p.pincode} inputMode="numeric" maxLength={6} className="input" /></div>
      <div className="sm:col-span-2"><SubmitButton>Save details</SubmitButton></div>
    </ActionForm>
  );
}

export function PasswordForm() {
  return (
    <ActionForm action={changePassword} className="space-y-4" resetOnOk>
      <div><label className="label" htmlFor="current">Current password</label><input id="current" name="current" type="password" autoComplete="current-password" required className="input" /></div>
      <div><label className="label" htmlFor="next">New password</label><input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required className="input" /></div>
      <SubmitButton className="btn-secondary">Change password</SubmitButton>
    </ActionForm>
  );
}
