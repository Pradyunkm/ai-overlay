import { createFileRoute } from "@tanstack/react-router";
import { Panel, PageHeader, Badge } from "@/components/layout/AppShell";
import { WaferGrid } from "@/components/viz/WaferMap";
import { useState } from "react";

export const Route = createFileRoute("/_app/overlay")({
  head: () => ({ meta: [{ title: "Overlay Analysis — SDF" }] }),
  component: OverlayAnalysis,
});

const metrics = [
  { label: "Overlay Shift", value: "4.06", unit: "nm", tone: "cyan" },
  { label: "Rotational Misalignment", value: "0.23", unit: "°", tone: "warning" },
  { label: "Edge Placement Error", value: "3.12", unit: "nm", tone: "violet" },
  { label: "Alignment Confidence", value: "97.6", unit: "%", tone: "neon" },
];

function OverlayAnalysis() {
  const [pos, setPos] = useState(50);
  return (
    <>
      <PageHeader title="Overlay Analysis" crumbs={["Home", "Overlay Analysis"]} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {metrics.map((m) => {
          const color = m.tone === "neon" ? "var(--neon)" : m.tone === "warning" ? "var(--warning)" : m.tone === "violet" ? "var(--violet)" : "var(--cyan)";
          return (
            <div key={m.label} className="glass rounded-lg p-4 relative">
              <div className="text-[10px] tracking-wider uppercase text-muted-foreground">{m.label}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-display" style={{ color }}>{m.value}</span>
                <span className="text-[12px] text-muted-foreground">{m.unit}</span>
              </div>
              <div className="mt-2 h-1 rounded bg-white/5 overflow-hidden">
                <div className="h-full" style={{ width: `${parseFloat(m.value) > 50 ? m.value : 70}%`, background: color }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-4">
        <Panel title="Split Screen Comparison" className="col-span-12 lg:col-span-7">
          <div className="relative aspect-[16/9] rounded-lg overflow-hidden glass-strong">
            <div className="absolute inset-0 grid place-items-center"><WaferGrid size={460} defects={false} /></div>
            <div className="absolute inset-0 grid place-items-center" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
              <WaferGrid size={460} />
            </div>
            <div className="absolute top-0 bottom-0 w-px bg-primary glow-cyan" style={{ left: `${pos}%` }}>
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-8 rounded-full bg-primary text-primary-foreground grid place-items-center font-display text-[10px]">↔</div>
            </div>
            <div className="absolute top-3 left-3"><Badge label="REFERENCE" tone="cyan" /></div>
            <div className="absolute top-3 right-3"><Badge label="TEST" tone="violet" /></div>
          </div>
          <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(+e.target.value)} className="w-full mt-3 accent-[color:var(--cyan)]" />
        </Panel>

        <Panel title="Overlay Difference" className="col-span-12 lg:col-span-5" action={<Badge label="Δ 10.0 max" tone="warning" />}>
          <div className="relative aspect-square max-w-[420px] mx-auto rounded-lg overflow-hidden">
            <svg viewBox="0 0 400 400" className="w-full h-full">
              <defs>
                <radialGradient id="bg" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="oklch(0.20 0.06 260)" />
                  <stop offset="100%" stopColor="oklch(0.10 0.03 260)" />
                </radialGradient>
              </defs>
              <circle cx="200" cy="200" r="195" fill="url(#bg)" stroke="oklch(0.78 0.18 200 / 0.4)" />
              {Array.from({ length: 80 }).map((_, i) => {
                const a = (i * 47) % 360;
                const r = (i * 13) % 170;
                const x = 200 + Math.cos(a) * r;
                const y = 200 + Math.sin(a) * r;
                const w = 6 + (i % 8);
                return <rect key={i} x={x - w/2} y={y - w/2} width={w} height={w} fill="oklch(0.95 0.05 200)" opacity={0.25 + (i % 5) * 0.15} />;
              })}
            </svg>
            <div className="absolute right-2 top-2 bottom-2 w-2 rounded" style={{ background: "linear-gradient(to bottom, oklch(0.65 0.25 25), oklch(0.78 0.18 60), oklch(0.82 0.17 200))" }} />
          </div>
        </Panel>
      </div>
    </>
  );
}
