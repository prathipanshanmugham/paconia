'use client';
import { useFormState } from 'react-dom';
import type { ReactNode } from 'react';

export type FormResult = { ok?: boolean; error?: string; message?: string; t?: number } | null;

/** Wraps a server action so validation errors show inline without a page reload. */
export default function ActionForm({ action, children, className, resetOnOk = false }: { action: (prev: FormResult, fd: FormData) => Promise<FormResult>; children: ReactNode; className?: string; resetOnOk?: boolean }) {
  const [state, run] = useFormState(action, null);
  return (
    <form action={run} className={className} key={resetOnOk && state?.ok ? String(state.t || 1) : 'form'}>
      {children}
      {state?.error && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
      {state?.ok && state.message && <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.message}</p>}
    </form>
  );
}
