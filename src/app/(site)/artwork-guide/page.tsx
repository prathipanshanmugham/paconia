import Link from 'next/link';
export const metadata = { title: 'Artwork guide', description: 'How to prepare print-ready files for labels, boxes, pouches and laser work at Paconia.' };
const ROWS: [string, string][] = [
  ['File type', 'PDF is best. AI, EPS, CDR, PSD, SVG and high-resolution PNG/JPG also work. Zip several files together if you like.'],
  ['Resolution', 'Photos and images at 300 dpi at the final size. Logos as vectors (AI, EPS, SVG or PDF) stay sharp at any size.'],
  ['Bleed', 'Add 2 mm of background beyond the cut line on every side, so no white edge shows after cutting.'],
  ['Safe area', 'Keep text and logos 3 mm inside the cut line.'],
  ['Colour', 'Set files in CMYK. Bright RGB greens and blues print a little duller. Send a Pantone reference if a colour must match.'],
  ['Text', 'Convert fonts to outlines, or send the font files. Minimum text size 6 pt, minimum line 0.25 pt.'],
  ['White ink', 'For clear, kraft, silver and dark stock we print white under the colour. Tell us if any area should stay unprinted (see-through or natural kraft).'],
  ['Laser work', 'Send cut lines as a 0.1 mm red stroke and engraving as solid black, both as vectors. Smallest detail about 0.5 mm.'],
];
export default function Guide() {
  return (
    <div className="wrap max-w-3xl py-12">
      <p className="kicker">Before you upload</p>
      <h1 className="mt-2 text-4xl font-bold">Artwork guide</h1>
      <p className="mt-3 text-ink-soft">No print-ready file? Upload what you have (even a phone photo of your logo). Our designer prepares it and sends you a proof before anything is printed. Small fixes are free.</p>
      <dl className="card mt-8 divide-y divide-line">
        {ROWS.map(([k, v]) => <div key={k} className="grid gap-1 px-5 py-4 sm:grid-cols-[150px_1fr]"><dt className="font-semibold">{k}</dt><dd className="text-sm text-ink-soft">{v}</dd></div>)}
      </dl>
      <div className="mt-8 rounded-xl bg-leaf-50 p-5 text-sm"><b>How proofs work.</b> We send a proof within one working day. You approve it or ask for changes from your account. We print only what you approve, so check spelling, numbers and size carefully.</div>
      <Link href="/shop" className="btn-primary mt-8">Start an order</Link>
    </div>
  );
}
