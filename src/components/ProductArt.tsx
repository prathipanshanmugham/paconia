/* Illustrated previews for each product shape, drawn as SVG so they can show the chosen material colour,
 * size and the customer's own logo. No photos needed. */
type Props = {
  shape: string;
  colour?: string | null;
  w?: number; h?: number; d?: number;
  round?: boolean;
  logo?: string | null;
  accent?: string;
  white?: boolean;
  dims?: boolean;
  className?: string;
  label?: string;
};

const shade = (hex: string, amt: number) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)));
  return '#' + ch.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
};
const lum = (hex: string) => {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0'), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};

function Mark({ x, y, w, h, logo, ink }: { x: number; y: number; w: number; h: number; logo?: string | null; ink: string }) {
  if (logo) return <image href={logo} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid meet" />;
  const fs = Math.min(h * 0.32, w * 0.15);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={Math.min(8, h * 0.15)} fill="none" stroke={ink} strokeOpacity={0.55} strokeDasharray="4 3" />
      <text x={x + w / 2} y={y + h / 2} dominantBaseline="central" textAnchor="middle" fill={ink} style={{ font: `800 ${fs}px "Bricolage Grotesque Variable", sans-serif`, letterSpacing: '0.04em' }}>YOUR LOGO</text>
    </g>
  );
}

export default function ProductArt({ shape, colour = '#FFFFFF', w = 60, h = 40, d = 40, round, logo, accent = '#4F7D14', white, dims = false, className = '', label }: Props) {
  const base = colour || '#FFFFFF';
  const dark = lum(base) < 0.45;
  const ink = dark ? '#FFFFFF' : accent;
  const edge = 'rgba(19,32,28,0.18)';
  const VW = 400, VH = 300;
  let g: JSX.Element;

  switch (shape) {
    case 'labels': {
      const sheetW = 240, sheetH = 230, sx = 80, sy = 36;
      const ratio = w / h;
      const lw = ratio >= 1 ? Math.min(96, 60 * ratio) : 60 * ratio;
      const lh = lw / ratio;
      const cols = Math.max(1, Math.floor((sheetW - 16) / (lw + 10))), rows = Math.max(1, Math.floor((sheetH - 16) / (lh + 10)));
      const cells = [];
      for (let r = 0; r < Math.min(rows, 4); r++) for (let c = 0; c < Math.min(cols, 4); c++) {
        const x = sx + 12 + c * (lw + 10), y = sy + 12 + r * (lh + 10);
        const peeled = r === 0 && c === 0;
        cells.push(
          <g key={`${r}-${c}`} transform={peeled ? `rotate(-12 ${x + lw / 2} ${y + lh / 2}) translate(-14 -14)` : undefined}>
            {round ? <ellipse cx={x + lw / 2} cy={y + lh / 2} rx={lw / 2} ry={lh / 2} fill={base} stroke={edge} /> : <rect x={x} y={y} width={lw} height={lh} rx={6} fill={base} stroke={edge} />}
            <Mark x={x + lw * 0.15} y={y + lh * 0.28} w={lw * 0.7} h={lh * 0.44} logo={logo} ink={ink} />
          </g>,
        );
      }
      g = <g><rect x={sx + 6} y={sy + 8} width={sheetW} height={sheetH} rx={8} fill="rgba(0,0,0,.08)" /><rect x={sx} y={sy} width={sheetW} height={sheetH} rx={8} fill="#F4F1E8" stroke={edge} />{cells}</g>;
      break;
    }
    case 'sticker': {
      g = <g transform="rotate(-6 200 150)">
        <path d="M120 70 Q200 30 285 75 Q330 150 280 225 Q200 270 118 228 Q72 150 120 70Z" fill="#fff" stroke={edge} />
        <path d="M134 84 Q200 52 272 88 Q308 150 268 212 Q200 248 132 214 Q94 150 134 84Z" fill={base} />
        <Mark x={145} y={115} w={110} h={70} logo={logo} ink={ink} />
      </g>;
      break;
    }
    case 'stickersheet': {
      const shapes = [<circle key="a" cx={150} cy={95} r={34} />, <rect key="b" x={205} y={62} width={70} height={64} rx={14} />, <path key="c" d="M130 170 l25 -45 l25 45z" />, <rect key="d" x={200} y={150} width={80} height={46} rx={23} />, <circle key="e" cx={160} cy={225} r={24} />, <path key="f" d="M228 210 l12 25 l27 4 l-20 18 l5 27 l-24 -13 l-24 13 l5 -27 l-20 -18 l27 -4z" />];
      g = <g><rect x={108} y={34} width={190} height={250} rx={10} fill="#F4F1E8" stroke={edge} />
        <g fill={base} stroke={edge}>{shapes}</g>
        <Mark x={128} y={80} w={44} h={30} logo={logo} ink={ink} /></g>;
      break;
    }
    case 'box':
    case 'sleeve': {
      const L = w, W = d || 40, H = h;
      const c = Math.cos(Math.PI / 6), s = 0.5;
      const P = (x: number, y: number, z: number) => [(x - y) * c, (x + y) * s - z];
      const pts = [P(0, 0, 0), P(L, 0, 0), P(L, W, 0), P(0, W, 0), P(0, 0, H), P(L, 0, H), P(L, W, H), P(0, W, H)];
      const minX = Math.min(...pts.map((p) => p[0])), maxX = Math.max(...pts.map((p) => p[0])), minY = Math.min(...pts.map((p) => p[1])), maxY = Math.max(...pts.map((p) => p[1]));
      const pad = dims ? 56 : 24;
      const k = Math.min((VW - 2 * pad) / (maxX - minX), (VH - 2 * pad) / (maxY - minY));
      const ox = (VW - (maxX - minX) * k) / 2 - minX * k, oy = (VH - (maxY - minY) * k) / 2 - minY * k;
      const T = (x: number, y: number, z: number) => { const p = P(x, y, z); return `${(ox + p[0] * k).toFixed(1)},${(oy + p[1] * k).toFixed(1)}`; };
      const face = (q: [number, number, number][], fill: string) => <polygon points={q.map((p) => T(...p)).join(' ')} fill={fill} stroke={edge} strokeLinejoin="round" />;
      const boxCol = shape === 'sleeve' ? '#EFE9DD' : base;
      const z0 = shape === 'sleeve' ? H * 0.3 : 0, z1 = shape === 'sleeve' ? H * 0.7 : H;
      const o = P(0, W, z1);
      const mtx = `matrix(${(c * k).toFixed(4)},${(s * k).toFixed(4)},0,${k.toFixed(4)},${(ox + o[0] * k).toFixed(2)},${(oy + o[1] * k).toFixed(2)})`;
      g = <g>
        <ellipse cx={VW / 2} cy={VH - pad + 8} rx={(maxX - minX) * k * 0.45} ry={10} fill="rgba(0,0,0,.08)" />
        {face([[0, W, 0], [L, W, 0], [L, W, H], [0, W, H]], boxCol)}
        {face([[L, 0, 0], [L, W, 0], [L, W, H], [L, 0, H]], shade(boxCol, -0.16))}
        {face([[0, 0, H], [L, 0, H], [L, W, H], [0, W, H]], shade(boxCol, 0.12))}
        {shape === 'box' && <polyline points={[T(0, W * 0.85, H), T(L, W * 0.85, H)].join(' ')} stroke={edge} fill="none" />}
        {shape === 'sleeve' && <g>
          {face([[0, W + 0.5, z0], [L, W + 0.5, z0], [L, W + 0.5, z1], [0, W + 0.5, z1]], base)}
          {face([[L + 0.5, 0, z0], [L + 0.5, W, z0], [L + 0.5, W, z1], [L + 0.5, 0, z1]], shade(base, -0.16))}
        </g>}
        <g transform={mtx}><Mark x={L * 0.15} y={(z1 - z0) * 0.2} w={L * 0.7} h={(z1 - z0) * 0.6} logo={logo} ink={ink} /></g>
        {dims && <g className="fill-ink-soft" style={{ font: '500 11px "JetBrains Mono Variable", monospace' }}>
          <text x={VW / 2 - 70} y={VH - 14} textAnchor="middle">L {L} mm</text>
          <text x={VW / 2 + 80} y={VH - 14} textAnchor="middle">W {W} mm</text>
          <text x={VW - 16} y={VH / 2} textAnchor="end">H {H} mm</text>
        </g>}
      </g>;
      break;
    }
    case 'tag': {
      g = <g transform="rotate(8 200 150)">
        <path d="M150 40 C150 18 250 18 250 40" fill="none" stroke="#9C8B73" strokeWidth={3} />
        <rect x={140} y={40} width={120} height={210} rx={18} fill={base} stroke={edge} />
        <circle cx={200} cy={66} r={9} fill="#F6F7F4" stroke={edge} />
        <Mark x={156} y={110} w={88} h={80} logo={logo} ink={ink} />
      </g>;
      break;
    }
    case 'card': case 'bizcard': case 'invite': {
      const big = shape === 'invite';
      const cw = big ? 170 : 210, ch = big ? 232 : 124;
      const cx = (VW - cw) / 2 + (big ? 30 : 10), cy = (VH - ch) / 2 + (big ? 0 : 14);
      g = <g>
        {big && <g transform="rotate(-8 140 160)"><rect x={70} y={80} width={190} height={140} rx={6} fill="#E8DCC4" stroke={edge} /><path d="M70 80 L165 150 L260 80" fill="none" stroke={edge} /></g>}
        {!big && <rect x={cx - 24} y={cy - 28} width={cw} height={ch} rx={8} fill={shade(base, dark ? 0.1 : -0.06)} stroke={edge} transform={`rotate(-7 ${cx} ${cy})`} />}
        <rect x={cx} y={cy} width={cw} height={ch} rx={big ? 6 : 8} fill={base} stroke={edge} />
        {white && <rect x={cx + 10} y={cy + 10} width={cw - 20} height={ch - 20} rx={4} fill="none" stroke="#fff" strokeOpacity={0.5} />}
        <Mark x={cx + cw * 0.18} y={cy + ch * (big ? 0.2 : 0.3)} w={cw * 0.64} h={ch * (big ? 0.3 : 0.4)} logo={logo} ink={ink} />
        {big && <g fill={ink} fillOpacity={0.55}><rect x={cx + 40} y={cy + ch * 0.62} width={cw - 80} height={4} rx={2} /><rect x={cx + 55} y={cy + ch * 0.68} width={cw - 110} height={4} rx={2} /><rect x={cx + 48} y={cy + ch * 0.74} width={cw - 96} height={4} rx={2} /></g>}
      </g>;
      break;
    }
    case 'pouch': {
      const pw = 170, ph = 230, px = (VW - pw) / 2, py = 30;
      g = <g>
        <ellipse cx={200} cy={py + ph + 6} rx={pw * 0.55} ry={9} fill="rgba(0,0,0,.08)" />
        <path d={`M${px + 6} ${py} H${px + pw - 6} Q${px + pw} ${py} ${px + pw} ${py + 6} V${py + ph * 0.84} Q${px + pw + 6} ${py + ph} ${px + pw - 12} ${py + ph} H${px + 12} Q${px - 6} ${py + ph} ${px} ${py + ph * 0.84} V${py + 6} Q${px} ${py} ${px + 6} ${py}Z`} fill={base} stroke={edge} />
        <rect x={px} y={py} width={pw} height={16} fill="rgba(0,0,0,.07)" />
        <line x1={px} x2={px + pw} y1={py + 30} y2={py + 30} stroke="rgba(0,0,0,.25)" strokeDasharray="3 3" />
        <path d={`M${px} ${py + ph * 0.84} Q${px + pw / 2} ${py + ph * 0.76} ${px + pw} ${py + ph * 0.84}`} fill="none" stroke={edge} />
        <Mark x={px + 25} y={py + 60} w={pw - 50} h={90} logo={logo} ink={ink} />
      </g>;
      break;
    }
    case 'acrylic': {
      const aw = 280, ah = Math.max(70, Math.min(190, (280 * h) / w)), ax = (VW - aw) / 2, ay = (VH - ah) / 2;
      g = <g>
        <rect x={ax + 8} y={ay + 10} width={aw} height={ah} rx={6} fill="rgba(0,0,0,.10)" />
        <rect x={ax} y={ay} width={aw} height={ah} rx={6} fill={base} fillOpacity={lum(base) > 0.85 ? 0.75 : 1} stroke={edge} />
        <path d={`M${ax + 20} ${ay} L${ax + 70} ${ay} L${ax + 20} ${ay + ah} L${ax - 0} ${ay + ah}Z`} fill="#fff" fillOpacity={0.18} />
        {[[ax + 14, ay + 14], [ax + aw - 14, ay + 14], [ax + 14, ay + ah - 14], [ax + aw - 14, ay + ah - 14]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={6} fill="#C9CED3" stroke={edge} />)}
        <Mark x={ax + aw * 0.18} y={ay + ah * 0.25} w={aw * 0.64} h={ah * 0.5} logo={logo} ink={dark ? '#fff' : lum(base) > 0.85 ? '#13201C' : '#fff'} />
      </g>;
      break;
    }
    case 'topper': {
      g = <g>
        <line x1={170} y1={170} x2={170} y2={280} stroke={base} strokeWidth={8} strokeLinecap="round" />
        <line x1={240} y1={170} x2={240} y2={280} stroke={base} strokeWidth={8} strokeLinecap="round" />
        <text x={205} y={150} textAnchor="middle" fill={base} stroke={shade(base, -0.3)} strokeWidth={1.2} style={{ font: 'italic 800 64px "Bricolage Grotesque Variable", serif' }}>Happy</text>
        <text x={205} y={200} textAnchor="middle" fill={base} stroke={shade(base, -0.3)} strokeWidth={1.2} style={{ font: 'italic 800 46px "Bricolage Grotesque Variable", serif' }}>Birthday</text>
      </g>;
      break;
    }
    case 'leather': {
      g = <g transform="rotate(-10 200 150)">
        <circle cx={118} cy={150} r={26} fill="none" stroke="#B7BCC2" strokeWidth={6} />
        <path d="M140 118 H282 Q300 118 300 136 V164 Q300 182 282 182 H140 Q122 182 122 164 V136 Q122 118 140 118Z" fill={base} stroke={shade(base, -0.35)} />
        <path d="M146 126 H278 Q292 126 292 140 V160 Q292 174 278 174 H146 Q130 174 130 160 V140 Q130 126 146 126Z" fill="none" stroke={shade(base, 0.25)} strokeDasharray="3 3" />
        <circle cx={142} cy={150} r={6} fill="#C9A646" stroke={shade(base, -0.4)} />
        <g opacity={0.8}><Mark x={170} y={134} w={110} h={32} logo={logo} ink={shade(base, -0.45)} /></g>
      </g>;
      break;
    }
    case 'coaster': {
      g = <g>
        <circle cx={208} cy={160} r={110} fill="rgba(0,0,0,.08)" />
        <circle cx={200} cy={150} r={110} fill={base} stroke={shade(base, -0.25)} />
        {[92, 80].map((r) => <circle key={r} cx={200} cy={150} r={r} fill="none" stroke={shade(base, -0.3)} strokeWidth={1.5} />)}
        <Mark x={140} y={118} w={120} h={64} logo={logo} ink={shade(base, -0.5)} />
      </g>;
      break;
    }
    default:
      g = <rect x={100} y={60} width={200} height={180} rx={12} fill={base} stroke={edge} />;
  }

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className={className} role="img" aria-label={label || 'Product preview'} xmlns="http://www.w3.org/2000/svg">
      {g}
    </svg>
  );
}
