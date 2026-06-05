import { createFileRoute } from "@tanstack/react-router";
import { Panel, PageHeader, Badge } from "@/components/layout/AppShell";
import { LiveLine, ScatterPlot, genTime, DonutChart } from "@/components/viz/Charts";
import { Activity, TrendingUp, Thermometer, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/process")({
  head: () => ({ meta: [{ title: "Process Health — SDF" }] }),
  component: Process,
});

const tipStyle = {
  background: "oklch(0.18 0.04 260 / 0.95)",
  border: "1px solid oklch(0.78 0.18 200 / 0.3)",
  borderRadius: 6, fontSize: 11, color: "white",
};

function Process() {
  const scatter = Array.from({ length: 80 }, (_, i) => ({
    x: (i % 20) / 2 - 5,
    y: 1 + Math.sin(i / 3) * 1.5 + Math.random() * 0.8,
    g: i % 3,
  }));

  return (
    <>
      <PageHeader title="Process Health" crumbs={["Home", "Process Health"]} />

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Wafer Yield",     value: "92.7%", sub: "+2.3% vs yesterday", tone: "neon",    icon: TrendingUp },
          { label: "Drift Score",     value: "18.6%", sub: "Medium Risk",         tone: "warning", icon: Activity },
          { label: "Temp Variation",  value: "+2.4°C",sub: "Stage temperature",   tone: "cyan",    icon: Thermometer },
          { label: "Oxidation Delta", value: "6.8%",  sub: "Inconsistency",       tone: "critical",icon: AlertTriangle },
        ].map((k) => {
          const color = k.tone === "neon" ? "var(--neon)" : k.tone === "warning" ? "var(--warning)" : k.tone === "critical" ? "var(--critical)" : "var(--cyan)";
          const Icon = k.icon;
          return (
            <div key={k.label} className="glass rounded-xl p-4 flex flex-col gap-2" style={{ borderTop: `2px solid ${color}` }}>
              <div className="flex items-center justify-between">
                <span className="label-text text-muted-foreground">{k.label}</span>
                <div className="size-7 rounded-lg grid place-items-center" style={{ background: `color-mix(in oklab, ${color} 12%, transparent)`, border: `1px solid color-mix(in oklab, ${color} 30%, transparent)` }}>
                  <Icon className="size-3.5" style={{ color }} />
                </div>
              </div>
              <div className="value-text" style={{ color }}>{k.value}</div>
              <div className="sub-text text-muted-foreground border-t border-border/40 pt-1.5">{k.sub}</div>
            </div>
          );
        })}
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-12 gap-3 mb-3">

        {/* Yield prediction */}
        <Panel title="Wafer Yield Prediction" className="col-span-12 lg:col-span-4"
          action={<Badge label="+2.3% vs yesterday" tone="neon" />}>
          <div className="flex items-center gap-4 mb-3">
            <div className="relative w-[100px] h-[100px] shrink-0">
              <DonutChart data={[
                { name: "Good Die", value: 92.7, color: "var(--neon)" },
                { name: "Bad Die",  value: 7.3,  color: "oklch(0.28 0.06 260)" },
              ]} />
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center">
                  <div className="text-lg font-bold" style={{ color: "var(--neon)", fontFamily: "Inter, sans-serif" }}>92.7%</div>
                  <div className="sub-text text-muted-foreground">Good</div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div><div className="sub-text text-muted-foreground">Good Die</div><div className="row-name-text" style={{ color: "var(--neon)" }}>8,742</div></div>
              <div><div className="sub-text text-muted-foreground">Total Die</div><div className="row-name-text">9,445</div></div>
            </div>
          </div>
          <LiveLine data={genTime(14, 90, 4)} color="var(--neon)" height={120} />
        </Panel>

        {/* Process drift */}
        <Panel title="Process Drift Analysis" className="col-span-12 lg:col-span-4"
          action={<Badge label="Medium Risk" tone="warning" />}>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="value-text" style={{ color: "var(--warning)" }}>18.6%</span>
            <span className="sub-text text-muted-foreground">Drift Score</span>
          </div>
          <LiveLine data={genTime(14, 25, 8)} color="var(--warning)" height={180} />
        </Panel>

        {/* Oxidation correlation */}
        <Panel title="Oxidation Process Correlation" className="col-span-12 lg:col-span-4">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="glass-strong rounded-lg p-2.5">
              <div className="sub-text text-muted-foreground mb-1">Temperature Var.</div>
              <div className="text-xl font-bold" style={{ color: "var(--cyan)", fontFamily: "Inter, sans-serif" }}>+2.4°C</div>
            </div>
            <div className="glass-strong rounded-lg p-2.5">
              <div className="sub-text text-muted-foreground mb-1">Oxidation Δ</div>
              <div className="text-xl font-bold" style={{ color: "var(--critical)", fontFamily: "Inter, sans-serif" }}>6.8%</div>
            </div>
          </div>
          <ScatterPlot data={scatter} />
        </Panel>
      </div>

      {/* ── Bottom: Trend & logs ── */}
      <div className="grid grid-cols-12 gap-3">
        <Panel title="Trend & Drift Analysis" subtitle="30-day rolling window" className="col-span-12 lg:col-span-8">
          <LiveLine data={genTime(20, 50, 20)} color="var(--cyan)" height={180} />
        </Panel>

        <Panel title="Process Parameters" className="col-span-12 lg:col-span-4">
          <ul className="divide-y divide-border/60 -mx-3">
            {[
              { k: "Exposure Time",   v: "0.82s",  t: "neon" },
              { k: "Focus Depth",     v: "−12 nm", t: "cyan" },
              { k: "Stage Temp",      v: "22.4°C", t: "warning" },
              { k: "Pressure",        v: "1.02 atm",t: "cyan" },
              { k: "Scan Speed",      v: "120 mm/s",t: "neon" },
              { k: "Alignment Score", v: "97.6%",  t: "neon" },
            ].map((p) => {
              const color = p.t === "neon" ? "var(--neon)" : p.t === "warning" ? "var(--warning)" : "var(--cyan)";
              return (
                <li key={p.k} className="flex items-center justify-between px-3 py-2.5">
                  <span className="row-desc-text text-muted-foreground">{p.k}</span>
                  <span className="mono-text font-semibold" style={{ color }}>{p.v}</span>
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </>
  );
}
