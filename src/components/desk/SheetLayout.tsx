/** Small picture of how pieces sit on the print sheet (SRA3 or a laser sheet). */
export default function SheetLayout({ sw, sh, pw, ph, n, gap = 3, margin = 5, className = 'h-24 w-auto' }: { sw: number; sh: number; pw: number; ph: number; n: number; gap?: number; margin?: number; className?: string }) {
  if (!n) return null;
  const fitA = { nx: Math.floor((sw - 2 * margin + gap) / (pw + gap)), ny: Math.floor((sh - 2 * margin + gap) / (ph + gap)) };
  const rot = fitA.nx * fitA.ny < n;
  const w = rot ? ph : pw, h = rot ? pw : ph;
  const nx = Math.max(1, Math.floor((sw - 2 * margin + gap) / (w + gap))), ny = Math.max(1, Math.floor((sh - 2 * margin + gap) / (h + gap)));
  const ox = (sw - (nx * w + (nx - 1) * gap)) / 2, oy = (sh - (ny * h + (ny - 1) * gap)) / 2;
  const cells = [];
  for (let x = 0; x < Math.min(nx, 40); x++) for (let y = 0; y < Math.min(ny, 40); y++) cells.push(<rect key={`${x}-${y}`} x={ox + x * (w + gap)} y={oy + y * (h + gap)} width={w} height={h} rx={2} fill="#CFEBF8" stroke="#1E93CB" strokeWidth={Math.max(sw, sh) / 300} />);
  return (
    <svg viewBox={`0 0 ${sw} ${sh}`} className={className} role="img" aria-label={`${n} pieces per ${sw} × ${sh} mm sheet`}>
      <rect width={sw} height={sh} rx={4} fill="#fff" stroke="#BFCDD4" strokeWidth={Math.max(sw, sh) / 200} />{cells}
    </svg>
  );
}
