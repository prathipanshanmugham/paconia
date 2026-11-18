import Link from 'next/link';
import InstantPrice from '@/components/site/InstantPrice';
import Reveal from '@/components/motion/Reveal';
import ProductStrip from '@/components/motion/ProductStrip';
import StepsTimeline from '@/components/motion/StepsTimeline';
import FoldingStory from '@/components/motion/FoldingStory';
import { productCards } from '@/lib/shop';
import { FAMILIES, allMaterialInfo, publicMats, publicPricing } from '@/lib/catalog';
import { getBusiness, getPricing } from '@/lib/settings';
import { unitPrice } from '@/components/site/money';
import type { ProductConfig } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

const STEPS: [string, string][] = [
  ['Choose and pay', 'Pick the size, material and quantity online, or send us a bulk enquiry. Upload your logo or artwork.'],
  ['Approve the proof', 'Our designer sends a proof within one working day. Ask for changes until it is right.'],
  ['We print', 'Printed on the OKI 9542 with white ink where it is needed, then cut, laminated and packed.'],
  ['Collect or receive', 'Pick it up at the studio in Perundurai, or we courier it anywhere in India with tracking.'],
];

const MACHINES = [
  ['OKI Pro 9542', 'Five-colour printer with white toner, for vivid colour on clear, kraft, metallic and dark stock.'],
  ['Toyocut B13', 'Cuts stickers and labels to any shape, kiss-cut on sheets or cut right through.'],
  ['CO2 laser', 'Cuts and engraves acrylic, wood, MDF and leather for signs, toppers and tags.'],
  ['Laminator and guillotine', 'Gloss, matte and soft-touch finishes; clean straight trims for cards and tags.'],
];

const POINTS = ['White ink under colour on clear and kraft', 'Proof within one working day', 'GST invoice on every order', 'Credit terms for regular businesses'];

export default async function Home() {
  const [cards, b, mats, ps] = await Promise.all([productCards(), getBusiness(), allMaterialInfo(), getPricing()]);
  const priceProducts = cards.map((c) => ({ id: c.id, slug: c.slug, name: c.name, family: c.family, model: c.model, shape: c.shape, gstRate: c.gstRate, leadDays: c.leadDays, config: c.config as unknown as ProductConfig, image: c.image && !c.image.photo ? c.image.src : null }));
  const strip = [...cards].sort((a, b) => Number(b.featured) - Number(a.featured)).filter((c) => c.image).map((c) => ({ slug: c.slug, name: c.name, image: c.image!.src, from: c.fromUnit !== null ? unitPrice(c.fromUnit) : null }));
  const points = (
    <ul className="mt-7 grid max-w-lg gap-3 text-[15px] sm:grid-cols-2">
      {POINTS.map((t, i) => <li key={t} className="flex gap-2.5"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${i % 3 === 0 ? 'bg-sky-400' : 'bg-leaf-300'}`} />{t}</li>)}
    </ul>
  );
  const ctas = <div className="mt-8 flex flex-wrap gap-3"><Link href="/shop" className="btn-secondary btn-lg">See all products</Link><Link href="/quote" className="btn-ghost btn-lg">Bulk or custom quote</Link></div>;

  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="wrap grid items-center gap-10 py-10 lg:grid-cols-[1fr_480px] lg:py-14">
          <div className="hero-in">
            <h1 className="max-w-xl text-[2.4rem] leading-[1.05] sm:text-[3.2rem]">Labels, boxes and pouches for your brand, printed in small runs.</h1>
            <p className="mt-5 max-w-lg text-lg text-ink-soft">From 25 pieces. You see the exact price before you order, approve a proof before we print, and collect from our Perundurai studio or get it couriered.</p>
            <div className="hidden lg:block">{points}{ctas}</div>
          </div>
          {priceProducts.length > 0 && <div className="hero-in hero-in-2"><InstantPrice products={priceProducts} mats={publicMats(mats)} ps={publicPricing(ps)} /></div>}
          <div className="lg:hidden">{points}{ctas}</div>
        </div>
      </section>

      <section className="overflow-hidden py-14">
        <div className="wrap flex flex-wrap items-end justify-between gap-4">
          <Reveal><h2 className="text-[1.75rem]">What we print</h2><p className="mt-1 max-w-xl text-ink-soft">Every product is priced online. Tap one to choose the size, material and quantity.</p></Reveal>
          <Reveal as="nav" aria-label="Product families" className="flex flex-wrap gap-2" delay={100}>
            {FAMILIES.map((f) => <Link key={f.key} href={`/shop/${f.slug}`} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-sm font-medium hover:border-sky-300 hover:text-sky-700">{f.name}</Link>)}
          </Reveal>
        </div>
        <Reveal className="mt-7" variant="fade" delay={150}><ProductStrip items={strip} /></Reveal>
      </section>

      <FoldingStory />

      <section className="bg-white">
        <div className="wrap py-14">
          <Reveal><h2 className="text-[1.75rem]">How an order works</h2></Reveal>
          <StepsTimeline steps={STEPS} />
        </div>
      </section>

      <section className="border-t border-line">
        <div className="wrap grid gap-10 py-14 lg:grid-cols-[1fr_1.1fr]">
          <Reveal variant="left">
            <h2 className="text-[1.75rem]">Printed in our studio, not sent out</h2>
            <p className="mt-3 max-w-md text-ink-soft">Packaging that fits your product and says what your brand stands for. We work with you on every order, from the first sample to the thousandth reorder.</p>
            <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-line">
              <p className="font-semibold">{b.tradeName} studio</p>
              <p className="mt-1 text-sm text-ink-soft">{b.address}, {b.city} {b.pincode}</p>
              <p className="text-sm text-ink-soft">{b.hours}</p>
              <div className="mt-4 flex flex-wrap gap-2"><a href={`https://wa.me/${b.whatsapp}`} className="btn-primary btn-sm">WhatsApp us</a><a href={`tel:${b.phone.replace(/\s/g, '')}`} className="btn-secondary btn-sm">Call {b.phone}</a></div>
            </div>
          </Reveal>
          <ul className="grid gap-px overflow-hidden rounded-2xl bg-line ring-1 ring-line sm:grid-cols-2">
            {MACHINES.map(([t, d], i) => <Reveal as="li" key={t} className="bg-white p-5" variant="fade" delay={i * 90}><h3 className="text-base">{t}</h3><p className="mt-1 text-sm text-ink-soft">{d}</p></Reveal>)}
          </ul>
        </div>
      </section>
    </>
  );
}
