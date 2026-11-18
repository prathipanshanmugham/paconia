import Link from 'next/link';
import { db } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { Badge, Notice, PageHead } from '@/components/ui';
import { STAGE_LABEL, routeOf } from '@/lib/orders';
import { dateShort } from '@/lib/format';
import SubmitButton from '@/components/SubmitButton';
import TabSelect from '@/components/TabSelect';
import { issueJobMaterials, moveJob, setJobMachine, toggleRush } from '@/app/actions/desk-orders';
import type { JobStage } from '@/generated/prisma/client';

export const metadata = { title: 'Production' };
const COLS: JobStage[] = ['PRINT', 'CUT', 'FINISH', 'PACK'];

export default async function Production({ searchParams }: { searchParams: { machine?: string; err?: string } }) {
  await requireStaff('production');
  const [jobs, machines, waiting, doneToday] = await Promise.all([
    db.job.findMany({
      where: { stage: { in: COLS }, orderItem: { order: { status: { in: ['IN_PRODUCTION', 'APPROVED'] } } }, ...(searchParams.machine ? { machine: { code: searchParams.machine } } : {}) },
      include: { machine: true, orderItem: { include: { order: { include: { customer: true } } } } },
      orderBy: [{ rush: 'desc' }, { dueDate: 'asc' }],
    }),
    db.machine.findMany({ where: { status: { not: 'RETIRED' } }, orderBy: { stage: 'asc' } }),
    db.job.count({ where: { stage: 'PREPRESS', orderItem: { order: { status: { notIn: ['CANCELLED'] } } } } }),
    db.job.count({ where: { stage: 'DONE', finishedAt: { gte: new Date(Date.now() - 86400000) } } }),
  ]);
  const now = new Date();
  const from = `/desk/production${searchParams.machine ? `?machine=${searchParams.machine}` : ''}`;
  return (
    <>
      <PageHead title="Production" sub={`${jobs.length} jobs on the floor · ${waiting} waiting for proof approval · ${doneToday} finished in the last 24 hours`} />
      {searchParams.err && <div className="mb-4"><Notice tone="bad">{searchParams.err}</Notice></div>}
      <div className="mb-5 max-w-xs"><label className="label" htmlFor="machine-filter">Show jobs on</label>
        <TabSelect current={from} items={[{ href: '/desk/production', label: 'All machines' }, ...machines.map((m) => ({ href: `/desk/production?machine=${m.code}`, label: `${m.name}${m.status === 'MAINTENANCE' ? ' (under maintenance)' : ''}` }))]} />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLS.map((st) => {
          const list = jobs.filter((j) => j.stage === st);
          return (
            <section key={st} className="rounded-2xl bg-mist/70 p-3">
              <h2 className="mb-3 flex items-center justify-between px-1 text-sm font-semibold">{STAGE_LABEL[st]}<span className="num rounded-full bg-white px-2 text-xs text-ink-soft">{list.length}</span></h2>
              <div className="space-y-3">
                {list.map((j) => {
                  const it = j.orderItem, o = it.order;
                  const late = j.dueDate && j.dueDate < now;
                  const route = routeOf(it.estimate);
                  const idx = route.indexOf(j.stage);
                  const next = idx >= 0 && idx < route.length - 1 ? STAGE_LABEL[route[idx + 1]] : 'Done';
                  return (
                    <article key={j.id} className={`card p-3 text-sm ${j.rush ? 'border-rose-300' : ''}`}>
                      <div className="flex items-center justify-between gap-2"><span className="mono text-xs text-ink-soft">{j.number}</span><span className="flex gap-1">{j.rush && <Badge tone="bad">Rush</Badge>}<span className={`text-xs ${late ? 'font-semibold text-rose-700' : 'text-ink-soft'}`}>{late ? 'late · ' : ''}{dateShort(j.dueDate)}</span></span></div>
                      <p className="mt-1 font-semibold leading-snug">{it.name} <span className="num font-normal">× {it.qty.toLocaleString('en-IN')}</span></p>
                      <p className="line-clamp-2 text-xs text-ink-soft">{it.summary}</p>
                      <p className="mt-1 text-xs"><Link href={`/desk/orders/${o.number}`} className="mono underline">{o.number}</Link> · {o.customer.company || o.customer.name}</p>
                      {j.ups ? <p className="num mt-1 text-xs text-ink-soft">{j.sheets} sheets · {j.ups} up</p> : null}
                      <form action={setJobMachine} className="mt-2 flex gap-1"><input type="hidden" name="jobId" value={j.id} /><input type="hidden" name="from" value={from} />
                        <select name="machineId" defaultValue={j.machineId || ''} className="input py-1 text-xs" aria-label="Machine"><option value="">No machine</option>{[...machines.filter((m) => m.stage === st), ...machines.filter((m) => m.stage !== st)].map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
                        <SubmitButton className="btn-ghost btn-sm px-2 text-xs" pendingText="…">Set</SubmitButton></form>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <form action={moveJob}><input type="hidden" name="jobId" value={j.id} /><input type="hidden" name="from" value={from} /><SubmitButton className="btn-primary btn-sm" pendingText="…">{next === 'Done' ? 'Done ✓' : `→ ${next}`}</SubmitButton></form>
                        {!j.materialsIssued && <form action={issueJobMaterials}><input type="hidden" name="jobId" value={j.id} /><input type="hidden" name="from" value={from} /><SubmitButton className="btn-ghost btn-sm text-xs" pendingText="…">Issue stock</SubmitButton></form>}
                        <form action={toggleRush}><input type="hidden" name="jobId" value={j.id} /><input type="hidden" name="from" value={from} /><SubmitButton className="btn-ghost btn-sm text-xs" pendingText="…">{j.rush ? 'Not rush' : 'Rush'}</SubmitButton></form>
                        <Link href={`/print/job/${o.number}`} className="btn-ghost btn-sm text-xs">Ticket</Link>
                      </div>
                    </article>
                  );
                })}
                {!list.length && <p className="px-1 py-6 text-center text-xs text-ink-faint">Nothing here</p>}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
