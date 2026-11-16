# Paconia

Website and in-house ERP for **Paconia** (Triagon Ventures, Perundurai, Erode) — custom labels, stickers, boxes,
pouches, cards and laser-cut work, printed on the Phase 1 unit: OKI Pro 9542 (CMYK + white, SRA3), Toyocut B13
cutter, CO2 laser, 380 mm laminator, 20" guillotine and the finishing bench.

One app, two sides:

| Area | Who | What it does |
|---|---|---|
| **Website** (`/`) | Customers | Live price configurator for 14 products, artwork upload, cart, checkout (Razorpay, pay at pickup, or credit for approved B2B accounts), proof approval, order tracking, GST invoices |
| **Desk** (`/desk`) | Staff | Today board, orders (website, walk-in, B2B), proofs, production board by machine, job tickets, quotes and enquiries, customers with credit terms, accounts (invoices, payments, receivables, expenses, GST summary + CSV), stock with purchase orders and goods receipt, catalogue and pricing rates, calculators, settings, team logins |

Every price — website, counter orders, quotes and calculators — comes from one engine (`src/lib/pricing.ts`):
SRA3 imposition for sheet work, blank + print cost for pouches, machine time for laser work, plus the rates in
**Desk → Catalogue → Pricing rates** and each material's price in **Stock**.

GST follows the September 2025 rates: boxes and cartons (4819) 5%; labels and tags (4821), printed matter (4911),
cards (4909), pouches and acrylic (3923/3926) 18%; wood (4421) and leather (4205) 5%. CGST + SGST inside Tamil Nadu,
IGST elsewhere, chosen from the delivery pincode or GSTIN.

## Roles

| Role | Can use |
|---|---|
| Owner | Everything, including team logins |
| Manager | Everything except team logins |
| Designer | Today, orders and proofs, production, quotes, customers, tools |
| Operator | Today, orders, production, stock, tools |
| Accounts | Today, orders, quotes, customers, accounts, stock, tools |

## Stack

Next.js 14 (App Router, server actions) · PostgreSQL 16 · Prisma 7 (driver adapter) · Tailwind · Razorpay ·
Docker. Uploaded files live in a Docker volume and are served through `/api/files/<id>` with access checks.

## Run locally

```bash
cp .env.example .env            # set DATABASE_URL, AUTH_SECRET; PAYMENTS_DEMO="1" to test without Razorpay
npm install
npx prisma migrate deploy
SEED_DEMO=1 npx tsx prisma/seed.ts   # owner login from OWNER_EMAIL/OWNER_PASSWORD + optional demo data
npm run dev
```

Demo staff (only with `SEED_DEMO=1`): manager@, designer@, operator@, accounts@paconia.in — password `Demo@12345`.

## Deploy

See [DEPLOY.md](DEPLOY.md). One command on the VPS: `bash deploy/bootstrap.sh <domain> <email>`.
