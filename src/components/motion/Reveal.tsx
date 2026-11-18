'use client';
import { useEffect, useRef, type ElementType, type ReactNode, type CSSProperties } from 'react';

/** Shows its content as it scrolls into view. Variants: rise (default), scale, fade. Delay staggers siblings. */
export default function Reveal({ as: Tag = 'div', children, className = '', delay = 0, variant = 'rise', style, ...rest }: { as?: ElementType; children: ReactNode; className?: string; delay?: number; variant?: 'rise' | 'scale' | 'fade' | 'left'; style?: CSSProperties } & Record<string, unknown>) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) { el.dataset.shown = ''; return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.dataset.shown = ''; io.disconnect(); } }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref} className={`reveal reveal-${variant} ${className}`} style={{ ...style, transitionDelay: delay ? `${delay}ms` : undefined }} {...rest}>{children}</Tag>;
}
