import type { ProductConfig } from '../src/lib/pricing';

type MaterialSeed = {
  code: string; name: string; category: 'MEDIA' | 'BLANK' | 'LASER' | 'TONER' | 'FILM' | 'CONSUMABLE' | 'PACKING'; uom: string;
  sheetW?: number; sheetH?: number; colour?: string; needsWhite?: boolean; cost: number; price: number; reorderLevel: number; reorderQty: number; demoOnHand: number; vendor?: string;
};

const SRA3 = { sheetW: 320, sheetH: 450 };
const LZR = { sheetW: 600, sheetH: 400 };
const SQFT = { sheetW: 305, sheetH: 305 };

// Costs and selling prices are starting points: change them in Desk → Stock (cost) and Catalogue → Pricing (selling rates).
export const MATERIALS: MaterialSeed[] = [
  { code: 'CHR', name: 'Chromo sticker paper', category: 'MEDIA', uom: 'sheet', ...SRA3, colour: '#FFFFFF', cost: 4.5, price: 7, reorderLevel: 300, reorderQty: 1000, demoOnHand: 820, vendor: 'media' },
  { code: 'PP-WHT', name: 'White PP waterproof sticker', category: 'MEDIA', uom: 'sheet', ...SRA3, colour: '#FFFFFF', cost: 11, price: 16, reorderLevel: 200, reorderQty: 500, demoOnHand: 340, vendor: 'media' },
  { code: 'PP-CLR', name: 'Clear PP sticker', category: 'MEDIA', uom: 'sheet', ...SRA3, colour: '#DCEEF4', needsWhite: true, cost: 13, price: 18, reorderLevel: 150, reorderQty: 500, demoOnHand: 95, vendor: 'media' },
  { code: 'KRF-STK', name: 'Kraft paper sticker', category: 'MEDIA', uom: 'sheet', ...SRA3, colour: '#C29B6E', needsWhite: true, cost: 8, price: 12, reorderLevel: 150, reorderQty: 500, demoOnHand: 260, vendor: 'media' },
  { code: 'PP-SLV', name: 'Silver metallic PP sticker', category: 'MEDIA', uom: 'sheet', ...SRA3, colour: '#C9CED3', needsWhite: true, cost: 18, price: 26, reorderLevel: 100, reorderQty: 250, demoOnHand: 140, vendor: 'media' },
  { code: 'PP-HOLO', name: 'Holographic sticker', category: 'MEDIA', uom: 'sheet', ...SRA3, colour: '#D8D2F0', needsWhite: true, cost: 24, price: 34, reorderLevel: 100, reorderQty: 250, demoOnHand: 60, vendor: 'media' },
  { code: 'CRD-300', name: '300 gsm art card', category: 'MEDIA', uom: 'sheet', ...SRA3, colour: '#FFFFFF', cost: 5.5, price: 8, reorderLevel: 300, reorderQty: 1000, demoOnHand: 900, vendor: 'paper' },
  { code: 'CRD-350', name: '350 gsm SBS board', category: 'MEDIA', uom: 'sheet', ...SRA3, colour: '#FFFFFF', cost: 7, price: 10, reorderLevel: 300, reorderQty: 1000, demoOnHand: 610, vendor: 'paper' },
  { code: 'TEX-300', name: '300 gsm ivory textured card', category: 'MEDIA', uom: 'sheet', ...SRA3, colour: '#F4EFE3', cost: 14, price: 20, reorderLevel: 100, reorderQty: 300, demoOnHand: 180, vendor: 'paper' },
  { code: 'MET-300', name: '300 gsm pearl metallic card', category: 'MEDIA', uom: 'sheet', ...SRA3, colour: '#ECE4CF', cost: 22, price: 30, reorderLevel: 50, reorderQty: 200, demoOnHand: 75, vendor: 'paper' },
  { code: 'KRF-CRD', name: '300 gsm kraft card', category: 'MEDIA', uom: 'sheet', ...SRA3, colour: '#B98B5C', needsWhite: true, cost: 7, price: 11, reorderLevel: 200, reorderQty: 500, demoOnHand: 420, vendor: 'paper' },
  { code: 'BLK-CRD', name: '300 gsm black card', category: 'MEDIA', uom: 'sheet', ...SRA3, colour: '#1F1F1F', needsWhite: true, cost: 9, price: 14, reorderLevel: 100, reorderQty: 300, demoOnHand: 70, vendor: 'paper' },

  { code: 'PCH-WK-100', name: 'White kraft zip pouch (100 g)', category: 'BLANK', uom: 'pcs', colour: '#F2EFE8', cost: 5, price: 8, reorderLevel: 200, reorderQty: 1000, demoOnHand: 600, vendor: 'pouch' },
  { code: 'PCH-WK-250', name: 'White kraft zip pouch (250 g)', category: 'BLANK', uom: 'pcs', colour: '#F2EFE8', cost: 7, price: 11, reorderLevel: 200, reorderQty: 1000, demoOnHand: 600, vendor: 'pouch' },
  { code: 'PCH-WK-500', name: 'White kraft zip pouch (500 g)', category: 'BLANK', uom: 'pcs', colour: '#F2EFE8', cost: 10, price: 15, reorderLevel: 150, reorderQty: 500, demoOnHand: 300, vendor: 'pouch' },
  { code: 'PCH-KR-100', name: 'Brown kraft zip pouch (100 g)', category: 'BLANK', uom: 'pcs', colour: '#C29B6E', needsWhite: true, cost: 4.5, price: 7, reorderLevel: 200, reorderQty: 1000, demoOnHand: 700, vendor: 'pouch' },
  { code: 'PCH-KR-250', name: 'Brown kraft zip pouch (250 g)', category: 'BLANK', uom: 'pcs', colour: '#C29B6E', needsWhite: true, cost: 6.5, price: 10, reorderLevel: 200, reorderQty: 1000, demoOnHand: 150, vendor: 'pouch' },
  { code: 'PCH-KR-500', name: 'Brown kraft zip pouch (500 g)', category: 'BLANK', uom: 'pcs', colour: '#C29B6E', needsWhite: true, cost: 9, price: 14, reorderLevel: 150, reorderQty: 500, demoOnHand: 240, vendor: 'pouch' },

  { code: 'ACR-3-CLR', name: 'Clear acrylic 3 mm', category: 'LASER', uom: 'sheet', ...LZR, colour: '#DCEEF4', cost: 320, price: 480, reorderLevel: 6, reorderQty: 20, demoOnHand: 18, vendor: 'laser' },
  { code: 'ACR-3-BLK', name: 'Black acrylic 3 mm', category: 'LASER', uom: 'sheet', ...LZR, colour: '#1C1C1C', cost: 340, price: 500, reorderLevel: 4, reorderQty: 10, demoOnHand: 9, vendor: 'laser' },
  { code: 'ACR-3-WHT', name: 'White acrylic 3 mm', category: 'LASER', uom: 'sheet', ...LZR, colour: '#FAFAFA', cost: 340, price: 500, reorderLevel: 4, reorderQty: 10, demoOnHand: 7, vendor: 'laser' },
  { code: 'ACR-3-GLD', name: 'Gold mirror acrylic 3 mm', category: 'LASER', uom: 'sheet', ...LZR, colour: '#D4AF37', cost: 520, price: 760, reorderLevel: 4, reorderQty: 10, demoOnHand: 3, vendor: 'laser' },
  { code: 'ACR-3-SLV', name: 'Silver mirror acrylic 3 mm', category: 'LASER', uom: 'sheet', ...LZR, colour: '#C8CCD0', cost: 500, price: 740, reorderLevel: 3, reorderQty: 10, demoOnHand: 4, vendor: 'laser' },
  { code: 'MDF-3', name: 'MDF 3 mm', category: 'LASER', uom: 'sheet', ...LZR, colour: '#B9946B', cost: 60, price: 110, reorderLevel: 10, reorderQty: 40, demoOnHand: 30, vendor: 'laser' },
  { code: 'PLY-3', name: 'Birch plywood 3 mm', category: 'LASER', uom: 'sheet', ...LZR, colour: '#D9B98C', cost: 140, price: 220, reorderLevel: 6, reorderQty: 20, demoOnHand: 12, vendor: 'laser' },
  { code: 'LTH-VEG', name: 'Veg-tan leather 2 mm', category: 'LASER', uom: 'sq ft', ...SQFT, colour: '#C68E5A', cost: 160, price: 260, reorderLevel: 8, reorderQty: 25, demoOnHand: 20, vendor: 'leather' },
  { code: 'LTH-BRN', name: 'Brown leather 1.8 mm', category: 'LASER', uom: 'sq ft', ...SQFT, colour: '#7A4A2A', cost: 170, price: 270, reorderLevel: 6, reorderQty: 20, demoOnHand: 12, vendor: 'leather' },
  { code: 'LTH-BLK', name: 'Black leather 1.8 mm', category: 'LASER', uom: 'sq ft', ...SQFT, colour: '#2A2420', cost: 170, price: 270, reorderLevel: 6, reorderQty: 20, demoOnHand: 8, vendor: 'leather' },

  { code: 'TNR-C', name: 'OKI Pro9542 toner, cyan', category: 'TONER', uom: 'cartridge', colour: '#00A3D9', cost: 9800, price: 0, reorderLevel: 1, reorderQty: 2, demoOnHand: 2, vendor: 'machine' },
  { code: 'TNR-M', name: 'OKI Pro9542 toner, magenta', category: 'TONER', uom: 'cartridge', colour: '#D6197A', cost: 9800, price: 0, reorderLevel: 1, reorderQty: 2, demoOnHand: 2, vendor: 'machine' },
  { code: 'TNR-Y', name: 'OKI Pro9542 toner, yellow', category: 'TONER', uom: 'cartridge', colour: '#F2C200', cost: 9800, price: 0, reorderLevel: 1, reorderQty: 2, demoOnHand: 2, vendor: 'machine' },
  { code: 'TNR-K', name: 'OKI Pro9542 toner, black', category: 'TONER', uom: 'cartridge', colour: '#13201C', cost: 8900, price: 0, reorderLevel: 1, reorderQty: 2, demoOnHand: 1, vendor: 'machine' },
  { code: 'TNR-W', name: 'OKI Pro9542 toner, white', category: 'TONER', uom: 'cartridge', colour: '#FFFFFF', cost: 12500, price: 0, reorderLevel: 1, reorderQty: 2, demoOnHand: 1, vendor: 'machine' },
  { code: 'LAM-GLS', name: 'Gloss thermal film 380 mm × 200 m', category: 'FILM', uom: 'roll', cost: 2600, price: 0, reorderLevel: 1, reorderQty: 2, demoOnHand: 2, vendor: 'machine' },
  { code: 'LAM-MAT', name: 'Matte thermal film 380 mm × 200 m', category: 'FILM', uom: 'roll', cost: 2800, price: 0, reorderLevel: 1, reorderQty: 2, demoOnHand: 1, vendor: 'machine' },
  { code: 'LAM-SFT', name: 'Soft-touch thermal film 380 mm × 200 m', category: 'FILM', uom: 'roll', cost: 5200, price: 0, reorderLevel: 1, reorderQty: 1, demoOnHand: 1, vendor: 'machine' },
  { code: 'BLADE-TC', name: 'Toyocut cutting blade', category: 'CONSUMABLE', uom: 'pcs', cost: 650, price: 0, reorderLevel: 2, reorderQty: 5, demoOnHand: 3, vendor: 'machine' },
  { code: 'ENV-57', name: 'Envelope 5 × 7 in (kraft / ivory)', category: 'CONSUMABLE', uom: 'pcs', cost: 4, price: 8, reorderLevel: 200, reorderQty: 500, demoOnHand: 400, vendor: 'paper' },
  { code: 'STR-20', name: 'Cotton string, 20 cm cut', category: 'CONSUMABLE', uom: 'pcs', cost: 0.6, price: 1.5, reorderLevel: 500, reorderQty: 2000, demoOnHand: 1500, vendor: 'pack' },
  { code: 'EYELET', name: 'Metal eyelet', category: 'CONSUMABLE', uom: 'pcs', cost: 0.5, price: 1.2, reorderLevel: 500, reorderQty: 2000, demoOnHand: 2000, vendor: 'pack' },
  { code: 'KEYRING', name: 'Split keyring 25 mm', category: 'CONSUMABLE', uom: 'pcs', cost: 3, price: 8, reorderLevel: 100, reorderQty: 500, demoOnHand: 300, vendor: 'pack' },
  { code: 'RIVET', name: 'Brass rivet', category: 'CONSUMABLE', uom: 'pcs', cost: 1, price: 3, reorderLevel: 100, reorderQty: 500, demoOnHand: 250, vendor: 'pack' },
  { code: 'CORK-90', name: 'Cork backing disc 90 mm', category: 'CONSUMABLE', uom: 'pcs', cost: 3, price: 6, reorderLevel: 50, reorderQty: 200, demoOnHand: 120, vendor: 'pack' },
  { code: 'STANDOFF', name: 'Acrylic standoff set (4 pcs)', category: 'CONSUMABLE', uom: 'set', cost: 70, price: 120, reorderLevel: 5, reorderQty: 20, demoOnHand: 15, vendor: 'pack' },
  { code: 'MAILER-S', name: 'Kraft mailer box (small)', category: 'PACKING', uom: 'pcs', cost: 14, price: 0, reorderLevel: 50, reorderQty: 200, demoOnHand: 80, vendor: 'pack' },
  { code: 'BUBBLE', name: 'Bubble wrap roll', category: 'PACKING', uom: 'roll', cost: 450, price: 0, reorderLevel: 1, reorderQty: 2, demoOnHand: 1, vendor: 'pack' },
];

export const MACHINES = [
  { code: 'OKI-9542', name: 'OKI Pro 9542 (CMYK + White)', kind: 'Digital press', stage: 'PRINT' as const, specs: 'SRA3 and 330 × 1320 mm banner, up to 360 gsm, five toners incl. white' },
  { code: 'LAM-380', name: 'Thermal roll laminator 380 mm', kind: 'Laminator', stage: 'PRINT' as const, specs: 'Hot and cold lamination, gloss / matte / soft-touch' },
  { code: 'TOYOCUT-B13', name: 'Toyocut B13 auto-feed cutter', kind: 'Label cutter', stage: 'CUT' as const, specs: '13 × 19 in sheets, kiss-cut and through-cut, CCD mark reading' },
  { code: 'GUILLOTINE', name: 'Paper guillotine 20 in', kind: 'Guillotine', stage: 'CUT' as const, specs: '500 mm cut width with back gauge' },
  { code: 'CO2-LASER', name: 'CO2 laser cutter & engraver', kind: 'Laser', stage: 'CUT' as const, specs: 'Cuts and engraves acrylic, MDF, ply and leather' },
  { code: 'FINISH-BENCH', name: 'Finishing bench', kind: 'Hand finishing', stage: 'FINISH' as const, specs: 'Creasing machine, corner cutter, eyelets, string, assembly' },
];

type ProductSeed = {
  slug: string; name: string; family: 'LABELS' | 'PACKAGING' | 'POUCHES' | 'CARDS' | 'LASER'; model: 'SHEET' | 'POUCH' | 'LASER';
  shape: string; hsn: string; gstRate: number; leadDays: number; featured?: boolean; tagline: string; description: string; config: ProductConfig;
};

export const PRODUCTS: ProductSeed[] = [
  {
    slug: 'product-labels', name: 'Product labels', family: 'LABELS', model: 'SHEET', shape: 'labels', hsn: '4821', gstRate: 18, leadDays: 2, featured: true,
    tagline: 'Jar, bottle, candle and food labels on sheets, ready to peel',
    description: 'Kiss-cut labels on easy-peel sheets. Waterproof PP for oils, sauces and cosmetics; chromo paper for dry goods; clear, kraft and silver with white ink under the colour so it stays bright.',
    config: {
      sizes: [{ label: 'Round 40 mm', w: 40, h: 40, round: true }, { label: 'Round 50 mm', w: 50, h: 50, round: true }, { label: 'Rectangle 60 × 40', w: 60, h: 40 }, { label: 'Rectangle 75 × 50', w: 75, h: 50 }, { label: 'Rectangle 100 × 70', w: 100, h: 70 }, { label: 'Jar wrap 200 × 60', w: 200, h: 60 }],
      custom: { minW: 15, maxW: 300, minH: 15, maxH: 420 },
      materials: ['CHR', 'PP-WHT', 'PP-CLR', 'KRF-STK', 'PP-SLV'], finishes: ['gloss', 'matte', 'none'],
      cut: 'kiss', form: 'flat', bleed: 1, gap: 3, qtyTiers: [100, 250, 500, 1000, 2500, 5000], minQty: 50,
    },
  },
  {
    slug: 'die-cut-stickers', name: 'Die-cut stickers', family: 'LABELS', model: 'SHEET', shape: 'sticker', hsn: '4821', gstRate: 18, leadDays: 3, featured: true,
    tagline: 'Logo and laptop stickers cut to their own shape',
    description: 'Individual stickers through-cut around your design on the Toyocut. Waterproof white PP, clear or holographic, with a protective lamination.',
    config: {
      sizes: [{ label: '50 mm', w: 50, h: 50 }, { label: '75 mm', w: 75, h: 75 }, { label: '100 mm', w: 100, h: 100 }],
      custom: { minW: 25, maxW: 250, minH: 25, maxH: 250 },
      materials: ['PP-WHT', 'PP-CLR', 'PP-HOLO', 'CHR'], finishes: ['gloss', 'matte', 'none'],
      cut: 'through', form: 'flat', bleed: 2, gap: 4, qtyTiers: [50, 100, 250, 500, 1000], minQty: 25,
    },
  },
  {
    slug: 'sticker-sheets', name: 'Sticker sheets', family: 'LABELS', model: 'SHEET', shape: 'stickersheet', hsn: '4821', gstRate: 18, leadDays: 3,
    tagline: 'Many small stickers on one sheet: planners, kids, festival packs',
    description: 'A full sheet of kiss-cut stickers in your layout, trimmed to size. Good for merchandise, return gifts and inserts.',
    config: {
      sizes: [{ label: 'A6 (105 × 148)', w: 105, h: 148 }, { label: '4 × 6 in (102 × 152)', w: 102, h: 152 }, { label: 'A5 (148 × 210)', w: 148, h: 210 }],
      custom: null, materials: ['CHR', 'PP-WHT', 'PP-HOLO'], finishes: ['gloss', 'matte', 'none'],
      cut: 'kiss', form: 'flat', bleed: 2, gap: 4, qtyTiers: [10, 25, 50, 100, 250], minQty: 10,
    },
  },
  {
    slug: 'product-boxes', name: 'Product boxes', family: 'PACKAGING', model: 'SHEET', shape: 'box', hsn: '4819', gstRate: 5, leadDays: 4, featured: true,
    tagline: 'Short-run tuck-end boxes from 25 pieces',
    description: 'Printed, cut and creased tuck-end cartons for cosmetics, candles, soaps, jewellery and spices. White ink on kraft and black board keeps your colours true.',
    config: {
      sizes: [{ label: 'Cosmetic 50 × 35 × 120', w: 50, d: 35, h: 120 }, { label: 'Cube 60 × 60 × 60', w: 60, d: 60, h: 60 }, { label: 'Soap 90 × 30 × 60', w: 90, d: 30, h: 60 }, { label: 'Tall 70 × 40 × 150', w: 70, d: 40, h: 150 }],
      custom: { minW: 30, maxW: 150, minH: 30, maxH: 200, minD: 20, maxD: 100 },
      materials: ['CRD-350', 'KRF-CRD', 'BLK-CRD'], finishes: ['matte', 'gloss', 'soft', 'none'],
      cut: 'through', form: 'box', bleed: 2, gap: 4, qtyTiers: [25, 50, 100, 250, 500], minQty: 25,
    },
  },
  {
    slug: 'box-sleeves', name: 'Sleeves & belly bands', family: 'PACKAGING', model: 'SHEET', shape: 'sleeve', hsn: '4819', gstRate: 5, leadDays: 3,
    tagline: 'Branded wraps for soap, candles, sweets and gift boxes',
    description: 'A printed band that wraps around your existing box or product. Sized to the item it goes around; we score the folds so it fits snugly.',
    config: {
      sizes: [{ label: 'Soap bar 90 × 30, band 60', w: 90, d: 30, h: 60 }, { label: 'Candle jar 70 × 70, band 50', w: 70, d: 70, h: 50 }, { label: 'Sweet box 150 × 40, band 40', w: 150, d: 40, h: 40 }],
      custom: { minW: 30, maxW: 180, minH: 20, maxH: 150, minD: 10, maxD: 60 },
      materials: ['CRD-300', 'KRF-CRD', 'BLK-CRD'], finishes: ['matte', 'gloss', 'none'],
      cut: 'guillotine', form: 'sleeve', bleed: 2, gap: 0, qtyTiers: [50, 100, 250, 500, 1000], minQty: 50,
    },
  },
  {
    slug: 'hang-tags', name: 'Hang tags', family: 'PACKAGING', model: 'SHEET', shape: 'tag', hsn: '4821', gstRate: 18, leadDays: 3,
    tagline: 'Swing tags for clothing, gifts and handmade goods',
    description: 'Thick card tags cut with rounded corners and a hole, printed one or both sides. Add cotton string or a metal eyelet.',
    config: {
      sizes: [{ label: '50 × 90 mm', w: 50, h: 90 }, { label: '55 × 85 mm', w: 55, h: 85 }, { label: '40 × 70 mm', w: 40, h: 70 }],
      custom: { minW: 30, maxW: 120, minH: 30, maxH: 150 },
      materials: ['CRD-350', 'KRF-CRD', 'BLK-CRD'], finishes: ['matte', 'gloss', 'none'], sides: true,
      cut: 'through', form: 'flat', bleed: 2, gap: 4, qtyTiers: [50, 100, 250, 500, 1000], minQty: 50,
      extras: [{ code: 'string', label: 'Cotton string, 20 cm', price: 1.5, per: 'piece', material: 'STR-20' }, { code: 'eyelet', label: 'Metal eyelet', price: 1.2, per: 'piece', material: 'EYELET' }],
    },
  },
  {
    slug: 'thank-you-cards', name: 'Thank-you & care cards', family: 'PACKAGING', model: 'SHEET', shape: 'card', hsn: '4911', gstRate: 18, leadDays: 2,
    tagline: 'Inserts for every parcel: thank-you notes, care instructions, offers',
    description: 'Printed on 300 gsm card, one or both sides, trimmed clean on the guillotine.',
    config: {
      sizes: [{ label: 'A6 (105 × 148)', w: 105, h: 148 }, { label: 'Mini (90 × 55)', w: 90, h: 55 }, { label: 'Square (100 × 100)', w: 100, h: 100 }],
      custom: { minW: 50, maxW: 210, minH: 50, maxH: 297 },
      materials: ['CRD-300', 'TEX-300', 'KRF-CRD'], finishes: ['matte', 'gloss', 'none'], sides: true,
      cut: 'guillotine', form: 'flat', bleed: 2, gap: 0, qtyTiers: [50, 100, 250, 500, 1000], minQty: 50,
    },
  },
  {
    slug: 'printed-pouches', name: 'Printed stand-up pouches', family: 'POUCHES', model: 'POUCH', shape: 'pouch', hsn: '3923', gstRate: 18, leadDays: 4, featured: true,
    tagline: 'Zip-lock pouches printed in full colour, from 50 pieces',
    description: 'Toner-printable zip-lock stand-up pouches printed directly on the OKI. White ink under the colour on brown kraft. Food-safe inner layer.',
    config: {
      sizes: [{ label: '100 g · 130 × 200 mm', w: 130, h: 200, code: '100' }, { label: '250 g · 160 × 240 mm', w: 160, h: 240, code: '250' }, { label: '500 g · 200 × 300 mm', w: 200, h: 300, code: '500' }],
      custom: null, materials: ['PCH-WK', 'PCH-KR'], finishes: ['none'],
      cut: 'none', form: 'flat', bleed: 0, gap: 0, qtyTiers: [50, 100, 250, 500, 1000], minQty: 50,
    },
  },
  {
    slug: 'business-cards', name: 'Business cards', family: 'CARDS', model: 'SHEET', shape: 'bizcard', hsn: '4911', gstRate: 18, leadDays: 2,
    tagline: 'Thick card, soft-touch or matte, white ink on black and kraft',
    description: 'Standard Indian size or square. Choose 350 gsm board, textured ivory, kraft or black with white ink. Rounded corners optional.',
    config: {
      sizes: [{ label: 'Standard 89 × 51', w: 89, h: 51 }, { label: 'European 85 × 55', w: 85, h: 55 }, { label: 'Square 64 × 64', w: 64, h: 64 }],
      custom: null, materials: ['CRD-350', 'TEX-300', 'KRF-CRD', 'BLK-CRD'], finishes: ['matte', 'soft', 'gloss', 'none'], sides: true,
      cut: 'guillotine', form: 'flat', bleed: 2, gap: 0, qtyTiers: [100, 200, 500, 1000, 2000], minQty: 100,
      extras: [{ code: 'corners', label: 'Rounded corners', price: 0.4, per: 'piece' }],
    },
  },
  {
    slug: 'invitations', name: 'Invitations', family: 'CARDS', model: 'SHEET', shape: 'invite', hsn: '4909', gstRate: 18, leadDays: 3, featured: true,
    tagline: 'Wedding and event cards, white ink on dark card, laser lace',
    description: 'Printed on textured, pearl or black card with white ink. Add envelopes or a laser-cut lace border.',
    config: {
      sizes: [{ label: '5 × 7 in (127 × 178)', w: 127, h: 178 }, { label: 'A5 (148 × 210)', w: 148, h: 210 }, { label: 'Square 6 in (152 × 152)', w: 152, h: 152 }],
      custom: null, materials: ['TEX-300', 'MET-300', 'BLK-CRD', 'KRF-CRD'], finishes: ['none', 'matte', 'soft'], sides: true,
      cut: 'guillotine', form: 'flat', bleed: 2, gap: 0, qtyTiers: [25, 50, 100, 200, 500], minQty: 25,
      extras: [{ code: 'envelope', label: 'Envelope', price: 8, per: 'piece', material: 'ENV-57' }, { code: 'lace', label: 'Laser-cut lace border', price: 18, per: 'piece' }],
    },
  },
  {
    slug: 'acrylic-signs', name: 'Acrylic name boards & signs', family: 'LASER', model: 'LASER', shape: 'acrylic', hsn: '3926', gstRate: 18, leadDays: 2, featured: true,
    tagline: 'Desk name plates, shop and office signs in clear, black or mirror acrylic',
    description: 'Laser-cut 3 mm acrylic with your text and logo engraved. Add wall standoffs or a desk stand.',
    config: {
      sizes: [{ label: 'Desk name plate 200 × 60', w: 200, h: 60 }, { label: 'Sign 300 × 200', w: 300, h: 200 }, { label: 'Sign 450 × 300', w: 450, h: 300 }],
      custom: { minW: 50, maxW: 580, minH: 30, maxH: 380 },
      materials: ['ACR-3-CLR', 'ACR-3-BLK', 'ACR-3-WHT', 'ACR-3-GLD'], finishes: ['engrave', 'cut'],
      cut: 'laser', form: 'flat', bleed: 0, gap: 2, qtyTiers: [1, 2, 5, 10, 25], minQty: 1,
      extras: [{ code: 'standoff', label: 'Wall standoffs (set of 4)', price: 120, per: 'piece', material: 'STANDOFF' }, { code: 'stand', label: 'Desk stand', price: 60, per: 'piece' }],
    },
  },
  {
    slug: 'cake-toppers', name: 'Cake toppers', family: 'LASER', model: 'LASER', shape: 'topper', hsn: '3926', gstRate: 18, leadDays: 2,
    tagline: 'Names and messages cut in gold, silver or black acrylic',
    description: 'Laser-cut 3 mm mirror acrylic with a stake, for birthdays, weddings and bakery orders.',
    config: {
      sizes: [{ label: 'Small 120 × 80', w: 120, h: 80 }, { label: 'Medium 150 × 100', w: 150, h: 100 }, { label: 'Large 200 × 120', w: 200, h: 120 }],
      custom: null, materials: ['ACR-3-GLD', 'ACR-3-SLV', 'ACR-3-BLK', 'ACR-3-WHT'], finishes: ['cut'],
      cut: 'laser', form: 'flat', bleed: 0, gap: 2, qtyTiers: [1, 2, 5, 10, 25], minQty: 1,
    },
  },
  {
    slug: 'leather-tags', name: 'Engraved leather tags & keychains', family: 'LASER', model: 'LASER', shape: 'leather', hsn: '4205', gstRate: 5, leadDays: 3,
    tagline: 'Laser-engraved leather keychains, labels and patches',
    description: 'Cut and engraved on genuine leather. Add a split keyring or a brass rivet. Popular for corporate gifts and product branding.',
    config: {
      sizes: [{ label: 'Keychain 70 × 35', w: 70, h: 35 }, { label: 'Label 50 × 30', w: 50, h: 30 }, { label: 'Patch 60 × 60', w: 60, h: 60 }],
      custom: { minW: 25, maxW: 150, minH: 20, maxH: 150 },
      materials: ['LTH-VEG', 'LTH-BRN', 'LTH-BLK'], finishes: ['engrave'],
      cut: 'laser', form: 'flat', bleed: 0, gap: 2, qtyTiers: [10, 25, 50, 100, 250], minQty: 10,
      extras: [{ code: 'keyring', label: 'Split keyring', price: 8, per: 'piece', material: 'KEYRING' }, { code: 'rivet', label: 'Brass rivet', price: 3, per: 'piece', material: 'RIVET' }],
    },
  },
  {
    slug: 'wood-coasters', name: 'Wooden coasters & cut-outs', family: 'LASER', model: 'LASER', shape: 'coaster', hsn: '4421', gstRate: 5, leadDays: 3,
    tagline: 'Engraved MDF and birch coasters, tags and décor',
    description: 'Laser-cut and engraved 3 mm MDF or birch ply. Add cork backing for coasters.',
    config: {
      sizes: [{ label: 'Round 90 mm', w: 90, h: 90, round: true }, { label: 'Square 95 mm', w: 95, h: 95 }, { label: 'Hexagon 100 mm', w: 100, h: 87 }],
      custom: { minW: 30, maxW: 380, minH: 30, maxH: 380 },
      materials: ['MDF-3', 'PLY-3'], finishes: ['engrave', 'cut'],
      cut: 'laser', form: 'flat', bleed: 0, gap: 2, qtyTiers: [4, 10, 25, 50, 100], minQty: 4,
      extras: [{ code: 'cork', label: 'Cork backing', price: 6, per: 'piece', material: 'CORK-90' }],
    },
  },
];
