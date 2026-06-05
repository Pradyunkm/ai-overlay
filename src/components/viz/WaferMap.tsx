import type { ReactElement } from "react";
// Procedural wafer/heatmap SVG visualizations — no external assets.
export function WaferGrid({ size = 280, defects = true }: { size?: number; defects?: boolean }) {
  const cells = 18;
  const cell = size / cells;
  const r = size / 2;
  const dies: ReactElement[] = [];
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const cx = x * cell + cell / 2;
      const cy = y * cell + cell / 2;
      const dx = cx - r;
      const dy = cy - r;
      if (Math.hypot(dx, dy) > r - cell * 0.3) continue;
      const seed = (x * 73 + y * 131) % 100;
      const heat = defects ? Math.max(0, Math.sin(x * 0.6) * Math.cos(y * 0.5) + seed / 200) : 0;
      const color = heat > 0.75 ? "oklch(0.65 0.25 25)" : heat > 0.55 ? "oklch(0.78 0.18 60)" : heat > 0.4 ? "oklch(0.82 0.17 200)" : "oklch(0.45 0.10 260)";
      dies.push(
        <rect key={`${x}-${y}`} x={x * cell + 1} y={y * cell + 1} width={cell - 2} height={cell - 2}
          fill={color} opacity={0.35 + heat * 0.65} rx={0.5} />
      );
    }
  }
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
      <defs>
        <radialGradient id="wg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="oklch(0.30 0.10 260)" />
          <stop offset="100%" stopColor="oklch(0.18 0.04 260)" />
        </radialGradient>
        <clipPath id="wclip"><circle cx={r} cy={r} r={r - 2} /></clipPath>
      </defs>
      <circle cx={r} cy={r} r={r - 1} fill="url(#wg)" stroke="oklch(0.78 0.18 200 / 0.4)" />
      <g clipPath="url(#wclip)">{dies}</g>
      {/* crosshair */}
      <line x1={r} y1={4} x2={r} y2={size - 4} stroke="oklch(0.78 0.18 200 / 0.5)" strokeDasharray="2 4" />
      <line x1={4} y1={r} x2={size - 4} y2={r} stroke="oklch(0.78 0.18 200 / 0.5)" strokeDasharray="2 4" />
      <circle cx={r} cy={r} r={r * 0.55} fill="none" stroke="oklch(0.78 0.18 200 / 0.3)" />
      <circle cx={r} cy={r} r={5} fill="oklch(0.82 0.24 145)" />
    </svg>
  );
}

export function HeatmapBlob({ size = 240 }: { size?: number }) {
  const r = size / 2;
  const blobs = Array.from({ length: 60 }, (_, i) => {
    const a = (i * 137) % 360;
    const rad = (i * 17) % (r * 0.85);
    return { x: r + Math.cos(a) * rad, y: r + Math.sin(a) * rad, s: 20 + (i % 5) * 6, c: i % 7 };
  });
  const palette = ["oklch(0.65 0.25 25)", "oklch(0.78 0.18 60)", "oklch(0.85 0.20 90)", "oklch(0.82 0.17 200)", "oklch(0.55 0.20 280)", "oklch(0.82 0.24 145)", "oklch(0.50 0.15 240)"];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full">
      <defs>
        <filter id="blur"><feGaussianBlur stdDeviation="8" /></filter>
        <clipPath id="hclip"><circle cx={r} cy={r} r={r - 2} /></clipPath>
      </defs>
      <circle cx={r} cy={r} r={r - 1} fill="oklch(0.18 0.04 260)" stroke="oklch(0.78 0.18 200 / 0.4)" />
      <g clipPath="url(#hclip)" filter="url(#blur)" opacity={0.85}>
        {blobs.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r={b.s} fill={palette[b.c]} />)}
      </g>
    </svg>
  );
}

export function FeatureMaps() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="aspect-square rounded glass-strong overflow-hidden relative">
          <svg viewBox="0 0 80 80" className="w-full h-full">
            <defs>
              <filter id={`fb${i}`}><feGaussianBlur stdDeviation="1.4" /></filter>
            </defs>
            <rect width="80" height="80" fill="oklch(0.16 0.05 280)" />
            <g filter={`url(#fb${i})`} opacity={0.9}>
              {Array.from({ length: 40 }).map((_, k) => {
                const x = (k * 17 + i * 5) % 80;
                const y = (k * 11 + i * 7) % 80;
                const s = 4 + ((k + i) % 6);
                const c = ["oklch(0.55 0.20 295)", "oklch(0.65 0.22 320)", "oklch(0.78 0.18 200)", "oklch(0.82 0.24 145)"][(k + i) % 4];
                return <circle key={k} cx={x} cy={y} r={s} fill={c} opacity={0.5} />;
              })}
            </g>
          </svg>
        </div>
      ))}
    </div>
  );
}

export function WaferThumb() {
  return (
    <div className="aspect-square rounded-md overflow-hidden glass-strong">
      <WaferGrid size={120} />
    </div>
  );
}
