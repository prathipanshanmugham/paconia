'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { confirmRazorpay, razorpayOrderFor } from '@/app/actions/shop';

type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
declare global { interface Window { Razorpay?: new (o: Record<string, unknown>) => { open(): void; on(e: string, cb: (r: unknown) => void): void } } }

function loadScript() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function RazorpayButton({ number, keyId, name, email, phone, label }: { number: string; keyId: string; name: string; email: string; phone: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function pay() {
    setBusy(true); setError(null);
    try {
      if (!(await loadScript())) throw new Error('Could not load Razorpay. Check your connection and try again.');
      const o = await razorpayOrderFor(number);
      if ('paid' in o) { router.push(`/account/orders/${number}`); return; }
      if ('error' in o) throw new Error(o.error);
      const rz = new window.Razorpay!({
        key: keyId, order_id: o.orderId, amount: o.amount, currency: 'INR', name: 'Paconia', description: `Order ${number}`,
        prefill: { name, email, contact: phone }, theme: { color: '#4F7D14' },
        handler: async (r: RzpResponse) => {
          const res = await confirmRazorpay(number, r);
          if ('error' in res && res.error) { setError(res.error); setBusy(false); return; }
          router.push(`/account/orders/${number}?paid=1`);
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rz.on('payment.failed', () => { setError('The payment did not go through. You can try again.'); setBusy(false); });
      rz.open();
    } catch (e) {
      setError((e as Error).message); setBusy(false);
    }
  }
  return (
    <div>
      <button type="button" onClick={pay} disabled={busy} className="btn-primary btn-lg w-full">{busy ? 'Opening payment…' : label}</button>
      {error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
    </div>
  );
}
