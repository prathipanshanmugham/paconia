'use client';
import Mockup3D from './Mockup3D';
import type { MockupSpec } from './mockup';

export default function RenderShot({ spec, view }: { spec: Omit<MockupSpec, 'logo'>; view?: { azimuth?: number; elevation?: number } }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'transparent' }}>
      <Mockup3D {...spec} view={view} preserve className="h-full w-full" onReady={() => setTimeout(() => { (window as unknown as { __ready: boolean }).__ready = true; }, 900)} />
    </div>
  );
}
