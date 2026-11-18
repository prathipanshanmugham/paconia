'use client';
import { useState } from 'react';
import { useFormState } from 'react-dom';
import SubmitButton from '@/components/SubmitButton';
import { createApiKey } from '@/app/actions/desk-ai';

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return <button type="button" className="btn-secondary btn-sm shrink-0" onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>{done ? 'Copied' : 'Copy'}</button>;
}

export default function ApiKeyForm({ users, base, me }: { users: { id: string; name: string; role: string }[]; base: string; me: string }) {
  const [state, run] = useFormState(createApiKey, null);
  return (
    <div>
      <form action={run} className="space-y-3" key={state?.t || 'new'}>
        <label className="block text-sm"><span className="label">Name</span><input name="name" required className="input" placeholder="Claude for Prathipan" /></label>
        <label className="block text-sm"><span className="label">Acts as</span><select name="userId" className="input" defaultValue={me}>{users.map((u) => <option key={u.id} value={u.id}>{u.name.includes(u.role) ? u.name : `${u.name}, ${u.role}`}</option>)}</select><span className="hint">The AI gets exactly this person’s permissions.</span></label>
        <label className="block text-sm"><span className="label">Access</span><select name="access" className="input"><option value="READ">Read only</option><option value="WRITE">Read and write</option></select><span className="hint">Read only looks things up. Read and write can also make quotes and orders, record payments and change stock.</span></label>
        {state?.error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
        <SubmitButton className="btn-primary w-full" pendingText="Creating…">Create key</SubmitButton>
      </form>
      {state?.key && (
        <div className="mt-5 rounded-xl border border-sky-300 bg-sky-50 p-4 text-sm" role="status">
          <p className="font-semibold">Key “{state.name}” created. Copy it now; it is shown only once.</p>
          <p className="mt-3 font-semibold">Connector URL for Claude</p>
          <div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs">{base}/mcp/{state.key}</code><Copy text={`${base}/mcp/${state.key}`} /></div>
          <p className="mt-3 font-semibold">Key alone (for scripts: Authorization: Bearer …)</p>
          <div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 break-all rounded-lg bg-white px-3 py-2 text-xs">{state.key}</code><Copy text={state.key} /></div>
        </div>
      )}
    </div>
  );
}
