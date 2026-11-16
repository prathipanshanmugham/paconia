/** Store policies (needed for Razorpay activation). Review the wording with your CA/lawyer before going live. */
export const POLICIES: Record<string, { title: string; body: (b: { legalName: string; tradeName: string; email: string; phone: string; address: string; city: string; pincode: string }) => [string, string][] }> = {
  terms: {
    title: 'Terms of service',
    body: (b) => [
      ['Who we are', `${b.tradeName} is a brand of ${b.legalName}, ${b.address}, ${b.city} ${b.pincode}, Tamil Nadu. By ordering on this website you agree to these terms.`],
      ['Custom products', 'Everything we sell is printed or cut to your specification. Prices on the website include the options you choose and are shown before GST; GST is added at checkout as per the HSN rate of each product.'],
      ['Artwork and proofs', 'You confirm you own or have permission to use the logos, images and text you send. We send a digital proof for each order. Printing starts only after you approve it, and you are responsible for checking spelling, numbers, sizes and layout on the proof.'],
      ['Colour and tolerance', 'Printed colours can vary slightly from what you see on screen and between print runs. Cutting can vary by up to 1 mm. Quantities can vary by up to 2% on large runs; we bill for what we deliver.'],
      ['Timelines', 'Lead times start after proof approval and payment (or credit approval). They are estimates in working days (Monday to Saturday) and exclude courier transit time.'],
      ['Payment', 'Online payments are processed by Razorpay. Business accounts with approved credit pay by the due date on the invoice.'],
      ['Liability', `Our liability for any order is limited to the amount paid for that order. We are not responsible for losses arising from delays or from errors in an approved proof.`],
      ['Jurisdiction', 'These terms are governed by the laws of India. Courts at Erode, Tamil Nadu have jurisdiction.'],
      ['Contact', `${b.email} · ${b.phone}`],
    ],
  },
  privacy: {
    title: 'Privacy policy',
    body: (b) => [
      ['What we collect', 'Your name, mobile number, email, business name, GSTIN, delivery address and the artwork you upload. Payment card or UPI details are entered on Razorpay and never reach our servers.'],
      ['Why we use it', 'To make and deliver your order, send proofs and updates, issue GST invoices and keep the records the law requires.'],
      ['Who we share it with', 'Only with the courier delivering your order, Razorpay for payments, and our accountant and tax authorities where the law requires. We do not sell your data.'],
      ['Your artwork', 'Your files are used only for your orders. We keep them so repeat orders are easy; ask us to delete them at any time.'],
      ['Cookies', 'We use a sign-in cookie and a cart cookie. We do not use advertising trackers.'],
      ['Your choices', `Email ${b.email} to see, correct or delete your information. Invoice records are kept for the period required under GST law.`],
    ],
  },
  refunds: {
    title: 'Cancellations & refunds',
    body: (b) => [
      ['Before proof approval', 'You can cancel any time before you approve the proof for a full refund, less any design work already done on request.'],
      ['After proof approval', 'Once you approve a proof the order is printed to your specification and cannot be cancelled or returned.'],
      ['If we make a mistake', 'If what you receive does not match the approved proof (wrong material, size, misprint or damage in transit), tell us within 7 days with photos. We reprint it free or refund it, as you prefer.'],
      ['How refunds are paid', 'Refunds go back to the original payment method within 5–7 working days of approval. Cash and counter payments are refunded by bank transfer or UPI.'],
      ['Contact', `${b.email} · ${b.phone}`],
    ],
  },
  shipping: {
    title: 'Shipping & pickup',
    body: (b) => [
      ['Pickup', `Collect free from our studio at ${b.address}, ${b.city}. We message you when the order is ready.`],
      ['Courier', 'We ship across India by courier. Shipping is charged at checkout and is free above the amount shown in your cart.'],
      ['When it ships', 'Orders ship after production, usually within the lead time shown on the product page after proof approval. Delivery takes 1–3 days in Tamil Nadu and 3–7 days elsewhere.'],
      ['Tracking', 'You receive the courier name and tracking number in your account and on the Track page.'],
      ['Damage in transit', 'If a parcel arrives damaged, photograph it before opening and contact us within 48 hours.'],
    ],
  },
};
