import { requireStaff } from '@/lib/auth';
import { getPricing } from '@/lib/settings';
import { PageHead } from '@/components/ui';
import ActionForm from '@/components/FormMessage';
import SubmitButton from '@/components/SubmitButton';
import { savePricing } from '@/app/actions/desk-admin';

export const metadata = { title: 'Pricing rates' };

export default async function Rates() {
  const s = await requireStaff('catalogue');
  const ps = await getPricing();
  const edit = ['OWNER', 'MANAGER'].includes(s.role);
  const groups: { title: string; hint: string; fields: [string, string, number][] }[] = [
    { title: 'Print sheet', hint: 'SRA3 sheet on the OKI 9542, in mm', fields: [['sheet.w', 'Width', ps.sheet.w], ['sheet.h', 'Height', ps.sheet.h], ['sheet.margin', 'Gripper margin', ps.sheet.margin], ['sheet.regMargin', 'Cutter mark margin', ps.sheet.regMargin]] },
    { title: 'Print clicks (₹ per SRA3 side)', hint: 'Toner + drum + maintenance per sheet side', fields: [['clicks.cmyk', 'CMYK', ps.clicks.cmyk], ['clicks.white', 'White underbase', ps.clicks.white]] },
    { title: 'Lamination (₹ per sheet)', hint: 'Film + labour on the 380 mm laminator', fields: [['lam.gloss', 'Gloss', ps.lam.gloss], ['lam.matte', 'Matte', ps.lam.matte], ['lam.soft', 'Soft-touch', ps.lam.soft]] },
    { title: 'Cutting (₹ per sheet)', hint: 'Toyocut B13 / guillotine / creasing', fields: [['cut.kiss', 'Kiss cut', ps.cut.kiss], ['cut.through', 'Through cut', ps.cut.through], ['cut.guillotine', 'Guillotine', ps.cut.guillotine], ['cut.crease', 'Crease (boxes)', ps.cut.crease]] },
    { title: 'CO2 laser', hint: 'Machine time and speeds', fields: [['laser.perMinute', '₹ per minute', ps.laser.perMinute], ['laser.setup', 'Setup ₹ per job', ps.laser.setup], ['laser.engraveCm2PerMin', 'Engrave cm² per min', ps.laser.engraveCm2PerMin], ['laser.engraveFill', 'Engraved share of area', ps.laser.engraveFill], ['laser.cutSpeed.ACR', 'Cut mm/min acrylic', ps.laser.cutSpeed.ACR], ['laser.cutSpeed.MDF', 'Cut mm/min MDF', ps.laser.cutSpeed.MDF], ['laser.cutSpeed.PLY', 'Cut mm/min ply', ps.laser.cutSpeed.PLY], ['laser.cutSpeed.LTH', 'Cut mm/min leather', ps.laser.cutSpeed.LTH]] },
    { title: 'Pouches', hint: 'Printing on ready pouch blanks', fields: [['pouch.print', 'Print ₹ per pouch', ps.pouch.print], ['pouch.white', 'White ₹ per pouch', ps.pouch.white], ['pouch.setup', 'Setup ₹ per job', ps.pouch.setup], ['pouch.wastePct', 'Waste %', ps.pouch.wastePct]] },
    { title: 'Job charges', hint: 'Applied to every sheet job', fields: [['setupFee', 'Setup ₹ per job', ps.setupFee], ['setupSheets', 'Setup sheets', ps.setupSheets], ['wastePct', 'Waste %', ps.wastePct], ['minLine', 'Minimum line ₹', ps.minLine]] },
  ];
  const costGroups: { title: string; hint: string; fields: [string, string, number][] }[] = [
    { title: 'Margin targets (%)', hint: 'The quote builder colours each line: green at or above target, amber below it, red under the minimum', fields: [['targetMargin', 'Target margin', ps.targetMargin], ['minMargin', 'Minimum margin', ps.minMargin]] },
    { title: 'Printing cost (₹ per SRA3 side)', hint: 'What toner, drum and service really cost you per click', fields: [['costs.clickCmyk', 'CMYK', ps.costs.clickCmyk], ['costs.clickWhite', 'White', ps.costs.clickWhite]] },
    { title: 'Lamination film cost (₹ per sheet)', hint: 'Film used for one SRA3 sheet', fields: [['costs.lam.gloss', 'Gloss', ps.costs.lam.gloss], ['costs.lam.matte', 'Matte', ps.costs.lam.matte], ['costs.lam.soft', 'Soft-touch', ps.costs.lam.soft]] },
    { title: 'Cutting cost (₹ per sheet)', hint: 'Blades, mats and operator time', fields: [['costs.cut.kiss', 'Kiss cut', ps.costs.cut.kiss], ['costs.cut.through', 'Through cut', ps.costs.cut.through], ['costs.cut.guillotine', 'Guillotine', ps.costs.cut.guillotine], ['costs.cut.crease', 'Crease', ps.costs.cut.crease]] },
    { title: 'Laser, pouch and setup cost', hint: 'Power, tube wear and labour', fields: [['costs.laserPerMinute', 'Laser ₹ per minute', ps.costs.laserPerMinute], ['costs.pouchPrint', 'Pouch print ₹ each', ps.costs.pouchPrint], ['costs.pouchWhite', 'Pouch white ₹ each', ps.costs.pouchWhite], ['costs.setup', 'Setup labour ₹ per job', ps.costs.setup]] },
  ];
  return (
    <>
      <PageHead back={{ href: '/desk/catalogue', label: 'Catalogue' }} title="Prices, costs & margins" sub="Every price on the website, in quotes and in the calculators comes from these rates plus each material’s quote price." />
      <ActionForm action={savePricing} className="space-y-6">
        <h2 className="text-xl">Selling rates</h2>
        <p className="-mt-4 text-sm text-ink-soft">What customers pay. Material selling prices are set on each material in Stock.</p>
        <div className="grid gap-6 lg:grid-cols-2">{groups.map((g) => (
          <fieldset key={g.title} className="card-pad" disabled={!edit}><legend className="sr-only">{g.title}</legend><h2 className="font-semibold">{g.title}</h2><p className="mb-3 text-xs text-ink-soft">{g.hint}</p>
            <div className="grid grid-cols-2 gap-3">{g.fields.map(([k, l, v]) => <label key={k} className="text-sm"><span className="label">{l}</span><input name={k} type="number" step="any" min="0" defaultValue={v} className="input" /></label>)}</div></fieldset>
        ))}</div>
        <h2 className="pt-4 text-xl">Your costs and margins</h2>
        <p className="-mt-4 text-sm text-ink-soft">What each step costs you. Margins on quotes and orders are worked out from these plus each material’s cost price. Staff only.</p>
        <div className="grid gap-6 lg:grid-cols-2">{costGroups.map((g) => (
          <fieldset key={g.title} className="card-pad" disabled={!edit}><legend className="sr-only">{g.title}</legend><h3 className="text-base font-semibold">{g.title}</h3><p className="mb-3 text-xs text-ink-soft">{g.hint}</p>
            <div className="grid grid-cols-2 gap-3">{g.fields.map(([k, l, v]) => <label key={k} className="text-sm"><span className="label">{l}</span><input name={k} type="number" step="any" min="0" defaultValue={v} className="input" /></label>)}</div></fieldset>
        ))}</div>
        {edit ? <SubmitButton>Save rates</SubmitButton> : <p className="text-sm text-ink-soft">Only the owner or a manager can change rates.</p>}
      </ActionForm>
    </>
  );
}
