'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Uploads files straight onto an order (artwork from a customer, or a proof from staff). */
export default function OrderFileUpload({ order, kind = 'ARTWORK', label = 'Upload artwork', onUploaded }: { order: string; kind?: 'ARTWORK' | 'PROOF'; label?: string; onUploaded?: (ids: string[]) => void }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function send(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true); setMsg(null);
    const fd = new FormData();
    Array.from(list).forEach((f) => fd.append('files', f));
    try {
      const res = await fetch(`/api/upload?order=${encodeURIComponent(order)}&kind=${kind}`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setMsg({ ok: true, text: `${data.files.length} file${data.files.length > 1 ? 's' : ''} uploaded${data.errors?.length ? '. ' + data.errors.join(' ') : ''}` });
      onUploaded?.(data.files.map((f: { id: string }) => f.id));
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  }
  return (
    <div>
      <label className={`btn-secondary btn-sm cursor-pointer ${busy ? 'pointer-events-none opacity-60' : ''}`}>
        {busy ? 'Uploading…' : label}
        <input ref={ref} type="file" multiple={kind === 'ARTWORK'} className="sr-only" onChange={(e) => send(e.target.files)} accept=".pdf,.ai,.eps,.psd,.cdr,.svg,.png,.jpg,.jpeg,.tif,.tiff,.webp,.zip" />
      </label>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`mt-2 text-xs ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{msg.text}</p>}
    </div>
  );
}
