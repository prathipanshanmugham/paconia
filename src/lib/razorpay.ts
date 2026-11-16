import Razorpay from 'razorpay';
import crypto from 'crypto';

/** Testing only: shows a 'simulate payment' button. Must never be on in production. */
export const paymentsDemo = () => process.env.PAYMENTS_DEMO === '1';
/** Razorpay is usable only when real keys are configured. */
export const razorpayReady = () => {
  const id = process.env.RAZORPAY_KEY_ID || '', sec = process.env.RAZORPAY_KEY_SECRET || '';
  return !!id && !!sec && !id.includes('REPLACE') && !sec.includes('REPLACE');
};
export const razorpayKeyId = () => process.env.RAZORPAY_KEY_ID || '';
export const razorpay = () => new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID || '', key_secret: process.env.RAZORPAY_KEY_SECRET || '' });

const safeEqual = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const realSecret = (v?: string) => !!v && v.length >= 8 && !v.includes('REPLACE');
export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string) {
  if (!realSecret(process.env.RAZORPAY_KEY_SECRET)) return false;
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '').update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature || '');
}
export function verifyWebhookSignature(body: string, signature: string) {
  if (!realSecret(process.env.RAZORPAY_WEBHOOK_SECRET)) return false; // never accept webhooks without a real secret
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || '').update(body).digest('hex');
  return safeEqual(expected, signature || '');
}
