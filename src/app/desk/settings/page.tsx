import { db } from '@/lib/db';
import { can, requireStaff, ROLE_LABEL } from '@/lib/auth';
import { getBusiness, getInvoicePrefs, getShipping } from '@/lib/settings';
import { Badge, PageHead, Tabs } from '@/components/ui';
import { dateShort, isoDate } from '@/lib/format';
import ActionForm from '@/components/FormMessage';
import SubmitButton from '@/components/SubmitButton';
import { saveBusiness, saveMachine, saveUser } from '@/app/actions/desk-admin';
import { paymentsDemo, razorpayReady } from '@/lib/razorpay';
import { revokeApiKey } from '@/app/actions/desk-ai';
import ApiKeyForm from '@/components/desk/ApiKeyForm';
import { dateTime } from '@/lib/format';

export const metadata = { title: 'Settings' };
const ROLES = ['OWNER', 'MANAGER', 'DESIGNER', 'OPERATOR', 'ACCOUNTS'] as const;
const ROLE_HINT: Record<(typeof ROLES)[number], string> = {
  OWNER: 'Everything, including team logins', MANAGER: 'Everything except team logins', DESIGNER: 'Orders, proofs, production, quotes, customers',
  OPERATOR: 'Production board, orders, stock, tools', ACCOUNTS: 'Orders, payments, invoices, accounts, stock',
};

export default async function Settings({ searchParams }: { searchParams: { tab?: string } }) {
  const s = await requireStaff('settings');
  const tab = (searchParams.tab === 'team' || searchParams.tab === 'ai') && can(s.role, 'users') ? searchParams.tab : searchParams.tab === 'machines' ? 'machines' : 'business';
  const items = [{ href: '/desk/settings', label: 'Business' }, ...(can(s.role, 'users') ? [{ href: '/desk/settings?tab=team', label: 'Team & logins' }, { href: '/desk/settings?tab=ai', label: 'AI & API access' }] : []), { href: '/desk/settings?tab=machines', label: 'Machines' }];
  return (
    <>
      <PageHead title="Settings" />
      <Tabs current={tab === 'business' ? '/desk/settings' : `/desk/settings?tab=${tab}`} items={items} />
      {tab === 'business' && <Business />}
      {tab === 'team' && <Team me={s.userId} />}
      {tab === 'machines' && <Machines />}
      {tab === 'ai' && <AiAccess me={s.userId} />}
    </>
  );
}

async function Business() {
  const [b, ship, inv] = await Promise.all([getBusiness(), getShipping(), getInvoicePrefs()]);
  const F = ({ k, l, v, span }: { k: string; l: string; v: string; span?: boolean }) => <label className={`text-sm ${span ? 'sm:col-span-2' : ''}`}><span className="label">{l}</span><input name={k} defaultValue={v} className="input" /></label>;
  return (
    <ActionForm action={saveBusiness} className="grid gap-6 xl:grid-cols-2">
      <section className="card-pad grid gap-3 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Business (on invoices and the website)</h2>
        <F k="legalName" l="Legal name" v={b.legalName} /><F k="tradeName" l="Brand" v={b.tradeName} />
        <F k="gstin" l="GSTIN" v={b.gstin} /><F k="stateCode" l="State code" v={b.stateCode} />
        <F k="address" l="Address" v={b.address} span /><F k="city" l="City" v={b.city} /><F k="pincode" l="Pincode" v={b.pincode} />
        <F k="state" l="State" v={b.state} /><F k="phone" l="Phone" v={b.phone} /><F k="whatsapp" l="WhatsApp (with 91)" v={b.whatsapp} /><F k="email" l="Email" v={b.email} />
        <F k="hours" l="Opening hours" v={b.hours} span />
      </section>
      <div className="space-y-6">
        <section className="card-pad grid gap-3 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Bank & UPI (printed on invoices)</h2>
          <F k="bankName" l="Bank" v={b.bankName} /><F k="bankBranch" l="Branch" v={b.bankBranch} /><F k="bankAccount" l="Account no." v={b.bankAccount} /><F k="bankIfsc" l="IFSC" v={b.bankIfsc} /><F k="upiId" l="UPI ID" v={b.upiId} span />
        </section>
        <section className="card-pad grid gap-3 sm:grid-cols-3">
          <h2 className="font-semibold sm:col-span-3">Shipping (₹)</h2>
          <label className="text-sm"><span className="label">Tamil Nadu</span><input name="ship.tamilNadu" type="number" min={0} defaultValue={ship.tamilNadu} className="input" /></label>
          <label className="text-sm"><span className="label">Other states</span><input name="ship.otherStates" type="number" min={0} defaultValue={ship.otherStates} className="input" /></label>
          <label className="text-sm"><span className="label">Free above</span><input name="ship.freeAbove" type="number" min={0} defaultValue={ship.freeAbove} className="input" /></label>
        </section>
        <section className="card-pad grid gap-3 sm:grid-cols-2">
          <h2 className="font-semibold sm:col-span-2">Invoices</h2>
          <label className="text-sm"><span className="label">Number prefix</span><input name="inv.prefix" defaultValue={inv.prefix} className="input mono uppercase" maxLength={6} /><p className="hint">PAC → PAC/26-27/0001 (GST allows 16 characters)</p></label>
          <label className="text-sm"><span className="label">Default credit days</span><input name="inv.creditDays" type="number" min={0} defaultValue={inv.creditDays} className="input" /></label>
          <label className="text-sm sm:col-span-2"><span className="label">Terms printed on invoices</span><textarea name="inv.terms" defaultValue={inv.terms} className="input min-h-[70px]" /></label>
        </section>
        <section className="card-pad text-sm">
          <h2 className="font-semibold">Online payments</h2>
          <p className="mt-2">{razorpayReady() ? <Badge tone="good">Razorpay connected</Badge> : paymentsDemo() ? <Badge tone="warn">Demo mode (test payments)</Badge> : <Badge tone="bad">Not set up</Badge>}</p>
          <p className="mt-2 text-ink-soft">Razorpay keys are set on the server (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET) so they never sit in the database.</p>
        </section>
        <SubmitButton>Save settings</SubmitButton>
      </div>
    </ActionForm>
  );
}

async function Team({ me }: { me: string }) {
  const users = await db.user.findMany({ where: { role: { not: 'CUSTOMER' } }, orderBy: [{ active: 'desc' }, { createdAt: 'asc' }] });
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-3">{users.map((u) => (
        <details key={u.id} className="card p-4">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2"><span><b>{u.name}</b> <span className="text-sm text-ink-soft">{u.email}</span>{u.id === me && <span className="text-xs text-ink-faint"> (you)</span>}</span><span className="flex gap-1"><Badge tone="info">{ROLE_LABEL[u.role]}</Badge>{!u.active && <Badge tone="muted">Inactive</Badge>}</span></summary>
          <ActionForm action={saveUser} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
            <input type="hidden" name="id" value={u.id} />
            <label className="text-sm"><span className="label">Name</span><input name="name" defaultValue={u.name} className="input" /></label>
            <label className="text-sm"><span className="label">Phone</span><input name="phone" defaultValue={u.phone || ''} className="input" /></label>
            <label className="text-sm"><span className="label">Role</span><select name="role" defaultValue={u.role} className="input">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></label>
            <label className="text-sm"><span className="label">New password</span><input name="password" type="password" autoComplete="new-password" className="input" placeholder="Leave blank to keep" /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={u.active} className="h-4 w-4 accent-leaf-600" />Can sign in</label>
            <div className="sm:col-span-2"><SubmitButton className="btn-secondary btn-sm">Save</SubmitButton></div>
          </ActionForm>
        </details>
      ))}</div>
      <div className="space-y-4">
        <section className="card-pad"><h2 className="mb-3 font-semibold">Add a team member</h2>
          <ActionForm action={saveUser} className="space-y-3" resetOnOk>
            <label className="block text-sm"><span className="label">Name</span><input name="name" required className="input" /></label>
            <label className="block text-sm"><span className="label">Email (their login)</span><input name="email" type="email" required className="input" /></label>
            <label className="block text-sm"><span className="label">Phone</span><input name="phone" className="input" /></label>
            <label className="block text-sm"><span className="label">Role</span><select name="role" defaultValue="OPERATOR" className="input">{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></label>
            <label className="block text-sm"><span className="label">Starting password</span><input name="password" type="password" autoComplete="new-password" minLength={8} required className="input" /></label>
            <SubmitButton className="btn-primary w-full">Add</SubmitButton>
          </ActionForm></section>
        <section className="card-pad text-sm"><h2 className="mb-2 font-semibold">What each role can do</h2><ul className="space-y-1.5">{ROLES.map((r) => <li key={r}><b>{ROLE_LABEL[r]}:</b> <span className="text-ink-soft">{ROLE_HINT[r]}</span></li>)}</ul></section>
      </div>
    </div>
  );
}

async function Machines() {
  const machines = await db.machine.findMany({ orderBy: { stage: 'asc' }, include: { _count: { select: { jobs: { where: { stage: { notIn: ['DONE', 'PREPRESS'] } } } } } } });
  return (
    <div className="grid gap-4 lg:grid-cols-2">{machines.map((m) => (
      <section key={m.id} className="card-pad">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-semibold">{m.name}</h2><p className="text-xs text-ink-soft"><span className="mono">{m.code}</span> · {m.kind} · {m._count.jobs} jobs on it now</p></div>
          <Badge tone={m.status === 'ACTIVE' ? 'good' : m.status === 'MAINTENANCE' ? 'warn' : 'muted'}>{m.status.toLowerCase()}</Badge></div>
        {m.nextServiceAt && <p className={`mt-1 text-xs ${m.nextServiceAt < new Date() ? 'text-rose-700' : 'text-ink-soft'}`}>Next service {dateShort(m.nextServiceAt)}</p>}
        <ActionForm action={saveMachine} className="mt-3 grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="id" value={m.id} />
          <label className="text-sm"><span className="label">Status</span><select name="status" defaultValue={m.status} className="input"><option value="ACTIVE">Working</option><option value="MAINTENANCE">Under maintenance</option><option value="RETIRED">Retired</option></select></label>
          <label className="text-sm"><span className="label">Last service</span><input type="date" name="lastServiceAt" defaultValue={m.lastServiceAt ? isoDate(m.lastServiceAt) : ''} className="input" /></label>
          <label className="text-sm"><span className="label">Next service</span><input type="date" name="nextServiceAt" defaultValue={m.nextServiceAt ? isoDate(m.nextServiceAt) : ''} className="input" /></label>
          <label className="text-sm sm:col-span-3"><span className="label">Specs</span><input name="specs" defaultValue={m.specs || ''} className="input" /></label>
          <label className="text-sm sm:col-span-3"><span className="label">Notes</span><input name="notes" defaultValue={m.notes || ''} className="input" placeholder="Service engineer, last issue…" /></label>
          <div><SubmitButton className="btn-secondary btn-sm">Save</SubmitButton></div>
        </ActionForm>
      </section>
    ))}</div>
  );
}

async function AiAccess({ me }: { me: string }) {
  const [keys, users] = await Promise.all([
    db.apiKey.findMany({ orderBy: [{ revokedAt: 'asc' }, { createdAt: 'desc' }], include: { user: true } }),
    db.user.findMany({ where: { role: { not: 'CUSTOMER' }, active: true }, orderBy: { name: 'asc' } }),
  ]);
  const base = (process.env.NEXT_PUBLIC_SITE_URL || 'https://paconia.com').replace(/\/$/, '');
  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="min-w-0 space-y-6">
        <section className="card overflow-x-auto">
          <div className="panel-head"><h2 className="text-base">Keys</h2><span className="text-sm text-ink-soft">{keys.filter((k) => !k.revokedAt).length} active</span></div>
          {keys.length ? <table className="tbl min-w-[640px]"><thead><tr><th>Key</th><th>Acts as</th><th>Access</th><th>Last used</th><th /></tr></thead>
            <tbody>{keys.map((k) => (
              <tr key={k.id} className={k.revokedAt ? 'opacity-50' : ''}>
                <td><b>{k.name}</b><div className="text-xs text-ink-faint">{k.prefix}…, made {dateTime(k.createdAt)}</div></td>
                <td>{k.user.name}<div className="text-xs text-ink-faint">{ROLE_LABEL[k.user.role]}</div></td>
                <td><Badge tone={k.access === 'WRITE' ? 'warn' : 'info'}>{k.access === 'WRITE' ? 'Read and write' : 'Read only'}</Badge></td>
                <td className="text-sm">{k.lastUsedAt ? <>{dateTime(k.lastUsedAt)}<div className="text-xs text-ink-faint">{k.uses} calls</div></> : <span className="text-ink-faint">Never</span>}</td>
                <td className="text-right">{k.revokedAt ? <span className="text-xs text-ink-faint">Revoked</span> : <form action={revokeApiKey}><input type="hidden" name="id" value={k.id} /><SubmitButton className="btn-ghost btn-sm text-rose-700" confirm={`Revoke “${k.name}”? Anything using it stops working at once.`} pendingText="…">Revoke</SubmitButton></form>}</td>
              </tr>
            ))}</tbody></table> : <p className="px-5 py-8 text-sm text-ink-soft">No keys yet. Create one to connect Claude.</p>}
        </section>
        <section className="card-pad text-sm">
          <h2 className="text-base">Connect Claude</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-soft">
            <li>Create a key on the right. Pick who it acts as and whether it may change things.</li>
            <li>In Claude, open Settings, then Connectors, and add a custom connector. Paste the connector URL shown after you create the key.</li>
            <li>Ask things like “what needs a proof today?”, “quote 2,000 kraft labels 75 × 50 for Kongu Foods at 40% margin” or “which quotes expire this week?”.</li>
          </ol>
          <p className="mt-4 font-semibold">What the AI can use</p>
          <p className="mt-1 text-ink-soft">Looking up: today’s overview, products and options, exact pricing with cost and margin, orders, quotes, customers, stock, the production board, enquiries, and sales, margin, money-to-collect, GST and expense reports. With a read-and-write key: add customers, make and renew quotes, turn quotes into orders, book orders, record payments, start production, move jobs, issue and adjust stock, hand over or cancel orders, add expenses.</p>
          <p className="mt-3 text-ink-soft">Every change appears in the order’s activity log with the key’s name. For scripts, the same tools are at <code className="break-all text-xs">{base}/api/v1/tools</code> with the header <code className="break-all text-xs">Authorization: Bearer pac_…</code>; MCP clients that send headers can use <code className="break-all text-xs">{base}/mcp</code>.</p>
        </section>
      </div>
      <section className="card-pad h-fit"><h2 className="mb-4 text-base">Create a key</h2><ApiKeyForm users={users.map((u) => ({ id: u.id, name: u.name, role: ROLE_LABEL[u.role] }))} base={base} me={me} /></section>
    </div>
  );
}
