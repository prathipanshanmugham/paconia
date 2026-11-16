'use client';
import { useFormStatus } from 'react-dom';
import type { ReactNode } from 'react';

export default function SubmitButton({ children, className = 'btn-primary', pendingText, name, value, formAction, confirm }: { children: ReactNode; className?: string; pendingText?: string; name?: string; value?: string; formAction?: (fd: FormData) => void | Promise<void>; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} name={name} value={value} formAction={formAction}
      onClick={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}>
      {pending ? pendingText || 'Saving…' : children}
    </button>
  );
}
