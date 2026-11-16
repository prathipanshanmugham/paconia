import Link from 'next/link';
import ProductArt from '@/components/ProductArt';
import ProductCard from '@/components/site/ProductCard';
import { productCards } from '@/lib/shop';
import { FAMILIES } from '@/lib/catalog';
import { getBusiness } from '@/lib/settings';
import { unitPrice } from '@/components/site/money';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const cards = await productCards();
  const featured = cards.filter((c) => c.featured).slice(0, 6);
  const b = await getBusiness();
  const famFrom = (key: string) => {
    const xs = cards.filter((c) => c.family === key && c.fromUnit !== null).map((c) => c.fromUnit!);
    return xs.length ? Math.min(...xs) : null;
  };
  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="wrap grid items-center gap-10 py-12 lg:grid-cols-[1.05fr_1fr] lg:py-16">
          <div>
            <p className="kicker">Print & packaging studio · Perundurai, Erode</p>
            <h1 className="mt-4 text-[2.6rem] font-extrabold leading-[1.02] sm:text-6xl">
              Labels, boxes and pouches that <span className="relative whitespace-nowrap"><span className="relative z-10">carry your brand</span><span className="absolute inset-x-0 bottom-1 z-0 h-3 bg-leaf-300/60 sm:h-4" aria-hidden /></span>.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-ink-soft">
              Short runs from 25 pieces. See your price as you choose the size and material, upload your artwork, and approve a proof before anything is printed.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/shop" className="btn-primary btn-lg">Shop products</Link>
              <Link href="/quote" className="btn-secondary btn-lg">Get a bulk quote</Link>
            </div>
            <dl className="mt-8 grid max-w-lg grid-cols-3 gap-4 border-t border-line pt-5 text-sm">
              <div><dt className="text-ink-soft">Minimum</dt><dd className="font-display text-xl font-bold">25 pcs</dd></div>
              <div><dt className="text-ink-soft">Ready in</dt><dd className="font-display text-xl font-bold">2–4 days</dd></div>
              <div><dt className="text-ink-soft">Proof</dt><dd className="font-display text-xl font-bold">Always</dd></div>
            </dl>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {[
              { shape: 'invite', colour: '#1F1F1F', cap: 'Black card, white ink', white: true },
              { shape: 'pouch', colour: '#C29B6E', cap: 'Kraft pouch, white underbase', white: true },
              { shape: 'labels', colour: '#DCEEF4', cap: 'Clear labels, white ink', w: 50, h: 50, round: true, white: true },
              { shape: 'box', colour: '#FFFFFF', cap: 'Tuck box, soft-touch', w: 60, h: 90, d: 40 },
            ].map((x, i) => (
              <figure key={i} className={`card overflow-hidden ${i % 2 ? 'translate-y-6' : ''}`}>
                <div className="aspect-[4/3] bg-mist"><ProductArt shape={x.shape} colour={x.colour} w={x.w} h={x.h} d={x.d} round={x.round} white={x.white} className="h-full w-full" label={x.cap} /></div>
                <figcaption className="px-3 py-2 text-xs font-medium text-ink-soft">{x.cap}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap py-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="text-3xl font-bold">What we make</h2><p className="mt-1 text-ink-soft">Five product families, all made in-house on our own machines.</p></div>
          <Link href="/shop" className="btn-secondary">See all products</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {FAMILIES.map((f) => {
            const from = famFrom(f.key);
            return (
              <Link key={f.key} href={`/shop/${f.slug}`} className="card group flex flex-col p-4 transition hover:shadow-lift">
                <h3 className="font-semibold">{f.name}</h3>
                <p className="mt-1 flex-1 text-sm text-ink-soft">{f.blurb}</p>
                <p className="mt-3 text-sm">{from !== null ? <>from <b className="num">{unitPrice(from)}</b> / pc</> : ' '}<span className="float-right text-leaf-600 transition group-hover:translate-x-0.5">→</span></p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="wrap pb-14">
        <h2 className="mb-6 text-3xl font-bold">Popular right now</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{featured.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      </section>

      <section className="border-y border-line bg-ink text-white">
        <div className="wrap grid gap-10 py-14 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-white/60">The fifth colour</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">White ink under the colour.</h2>
            <p className="mt-4 text-white/75">
              Most digital printers have four colours. Ours has five: cyan, magenta, yellow, black and white. White goes down first on clear, kraft,
              metallic and black stock, so your logo stays bright instead of disappearing into the material.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[['Kraft', '#B98B5C'], ['Clear', '#DCEEF4'], ['Black', '#1F1F1F']].map(([n, c]) => (
              <div key={n} className="overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10">
                <div className="aspect-square"><ProductArt shape="bizcard" colour={c} white className="h-full w-full" label={`${n} card with white ink`} /></div>
                <p className="px-3 pb-3 text-sm text-white/70">{n}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="wrap py-14">
        <h2 className="text-3xl font-bold">How an order works</h2>
        <ol className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Choose', 'Pick the size, material, finish and quantity. The price updates as you go, GST shown before you pay.'],
            ['Upload', 'Send your artwork as PDF, AI, PNG or JPG. No artwork yet? Tell us what you need and our designer helps.'],
            ['Approve', 'We send a digital proof on the cutline within one working day. Nothing prints until you approve it.'],
            ['Collect', 'We print, cut and pack in Perundurai. Pick up from the studio or we courier it across India.'],
          ].map(([t, d], i) => (
            <li key={t} className="bg-white p-5">
              <span className="font-mono text-xs text-leaf-600">0{i + 1}</span>
              <h3 className="mt-1 text-lg font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-ink-soft">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="wrap grid gap-6 pb-6 lg:grid-cols-2">
        <div className="card-pad">
          <p className="kicker">Our mission</p>
          <p className="mt-3 font-display text-2xl font-semibold leading-snug">
            Customizable packaging that combines creativity and functionality, developed closely with each client so it meets their needs and reflects their brand&apos;s values.
          </p>
        </div>
        <div className="card-pad flex flex-col">
          <p className="kicker">For businesses</p>
          <h3 className="mt-3 text-2xl font-bold">Repeat orders, GST invoices, credit terms.</h3>
          <p className="mt-2 flex-1 text-ink-soft">Brands, shops and caterers ordering regularly get a business account with saved artwork, quotes for large runs and invoices with your GSTIN.</p>
          <div className="mt-4 flex flex-wrap gap-2"><Link href="/quote" className="btn-primary">Request a quote</Link><a href={`https://wa.me/${b.whatsapp}`} className="btn-secondary">WhatsApp us</a></div>
        </div>
      </section>
    </>
  );
}
