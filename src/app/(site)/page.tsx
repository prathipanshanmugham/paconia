import Link from 'next/link';
import ProductArt from '@/components/ProductArt';
import InstantPrice from '@/components/site/InstantPrice';
import { productCards } from '@/lib/shop';
import { FAMILIES, allMaterialInfo, publicMats, publicPricing } from '@/lib/catalog';
import { getBusiness, getPricing } from '@/lib/settings';
import { unitPrice } from '@/components/site/money';
import type { ProductConfig } from '@/lib/pricing';

export const dynamic = 'force-dynamic';

const STEPS = [
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

export default async function Home() {
  const [cards, b, mats, ps] = await Promise.all([productCards(), getBusiness(), allMaterialInfo(), getPricing()]);
  const famFrom = (key: string) => {
    const xs = cards.filter((c) => c.family === key && c.fromUnit !== null).map((c) => c.fromUnit!);
    return xs.length ? Math.min(...xs) : null;
  };
  const famArt = (key: string) => cards.find((c) => c.family === key);
  const priceProducts = cards.map((c) => ({ id: c.id, slug: c.slug, name: c.name, family: c.family, model: c.model, shape: c.shape, gstRate: c.gstRate, leadDays: c.leadDays, config: c.config as unknown as ProductConfig }));

  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="wrap grid items-center gap-10 py-10 lg:grid-cols-[1fr_480px] lg:py-16">
          <div>
            <h1 className="max-w-xl text-[2.4rem] leading-[1.05] sm:text-[3.2rem]">Labels, boxes and pouches for your brand, printed in small runs.</h1>
            <p className="mt-5 max-w-lg text-lg text-ink-soft">From 25 pieces. You see the exact price before you order, approve a proof before we print, and collect from our Perundurai studio or get it couriered.</p>
            <div className="hidden lg:block">
            <ul className="mt-7 grid max-w-lg gap-3 text-[15px] sm:grid-cols-2">
              <li className="flex gap-2.5"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />White ink under colour on clear and kraft</li>
              <li className="flex gap-2.5"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-leaf-300" />Proof within one working day</li>
              <li className="flex gap-2.5"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />GST invoice on every order</li>
              <li className="flex gap-2.5"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-leaf-300" />Credit terms for regular businesses</li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/shop" className="btn-secondary btn-lg">See all products</Link><Link href="/quote" className="btn-ghost btn-lg">Bulk or custom quote</Link></div>
            </div>
          </div>
          {priceProducts.length > 0 && <InstantPrice products={priceProducts} mats={publicMats(mats)} ps={publicPricing(ps)} />}
          <div className="lg:hidden">
            <ul className="mt-7 grid max-w-lg gap-3 text-[15px] sm:grid-cols-2">
              <li className="flex gap-2.5"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />White ink under colour on clear and kraft</li>
              <li className="flex gap-2.5"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-leaf-300" />Proof within one working day</li>
              <li className="flex gap-2.5"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-400" />GST invoice on every order</li>
              <li className="flex gap-2.5"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-leaf-300" />Credit terms for regular businesses</li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/shop" className="btn-secondary btn-lg">See all products</Link><Link href="/quote" className="btn-ghost btn-lg">Bulk or custom quote</Link></div>
          </div>
        </div>
      </section>

      <section className="wrap py-14">
        <h2 className="text-[1.75rem]">What we print</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {FAMILIES.map((f) => {
            const a = famArt(f.key), from = famFrom(f.key);
            return (
              <Link key={f.key} href={`/shop/${f.slug}`} className="group flex flex-col rounded-2xl border border-line bg-white p-4 transition-colors hover:border-sky-300">
                <div className="aspect-[4/3] rounded-xl bg-paper">{a && <ProductArt shape={a.shape} colour={a.colour} w={a.w} h={a.h} d={a.d} round={a.round} className="h-full w-full" label={f.name} />}</div>
                <h3 className="mt-3 text-[17px] group-hover:text-sky-700">{f.name}</h3>
                <p className="mt-1 text-sm text-ink-soft">{f.blurb}</p>
                {from !== null && <p className="mt-auto pt-3 text-sm text-ink-soft">From <b className="num text-ink">{unitPrice(from)}</b> a piece</p>}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="wrap py-14">
          <h2 className="text-[1.75rem]">How an order works</h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="relative pl-12">
                <span className="num absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-sky-50 text-base font-bold text-sky-700">{i + 1}</span>
                <h3 className="text-lg">{t}</h3>
                <p className="mt-1.5 text-[15px] text-ink-soft">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="wrap grid gap-10 py-14 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="text-[1.75rem]">Printed in our studio, not sent out</h2>
          <p className="mt-3 max-w-md text-ink-soft">Packaging that fits your product and says what your brand stands for. We work with you on every order, from the first sample to the thousandth reorder.</p>
          <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-line">
            <p className="font-semibold">{b.tradeName} studio</p>
            <p className="mt-1 text-sm text-ink-soft">{b.address}, {b.city} {b.pincode}</p>
            <p className="text-sm text-ink-soft">{b.hours}</p>
            <div className="mt-4 flex flex-wrap gap-2"><a href={`https://wa.me/${b.whatsapp}`} className="btn-primary btn-sm">WhatsApp us</a><a href={`tel:${b.phone.replace(/\s/g, '')}`} className="btn-secondary btn-sm">Call {b.phone}</a></div>
          </div>
        </div>
        <ul className="grid gap-px overflow-hidden rounded-2xl bg-line ring-1 ring-line sm:grid-cols-2">
          {MACHINES.map(([t, d]) => <li key={t} className="bg-white p-5"><h3 className="text-base">{t}</h3><p className="mt-1 text-sm text-ink-soft">{d}</p></li>)}
        </ul>
      </section>
    </>
  );
}
