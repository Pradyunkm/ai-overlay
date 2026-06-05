import { createFileRoute } from "@tanstack/react-router";
import { Panel, PageHeader, Badge } from "@/components/layout/AppShell";
import { HeatmapBlob, FeatureMaps, WaferGrid } from "@/components/viz/WaferMap";
import { DonutChart, LiveLine, genTime } from "@/components/viz/Charts";
import { AlertTriangle, TrendingDown, ShieldAlert, Eye, Filter } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";

export const Route = createFileRoute("/_app/defects")({
  head: () => ({ meta: [{ title: "Defect Analytics — SDF" }] }),
  component: Defects,
});

const classes = [
  { name: "Overlay Mismatch",      n: 35, pct: 27.3, color: "var(--cyan)" },
  { name: "Edge Deformation",       n: 28, pct: 21.9, color: "var(--warning)" },
  { name: "Pattern Distortion",     n: 22, pct: 17.2, color: "var(--violet)" },
  { name: "Line Break",             n: 18, pct: 14.1, color: "var(--neon)" },
  { name: "Particle Contamination", n: 15, pct: 11.7, color: "var(--critical)" },
  { name: "Others",                 n: 10, pct: 7.8,  color: "oklch(0.55 0.05 240)" },
];

const severityDist = [
  { name: "Critical", value: 15, color: "var(--critical)" },
  { name: "High",     value: 28, color: "var(--warning)" },
  { name: "Medium",   value: 45, color: "var(--violet)" },
  { name: "Low",      value: 40, color: "var(--cyan)" },
];

const barData = classes.map((c) => ({ name: c.name.split(" ")[0], count: c.n, color: c.color }));

const tipStyle = {
  background: "oklch(0.18 0.04 260 / 0.95)",
  border: "1px solid oklch(0.78 0.18 200 / 0.3)",
  borderRadius: 6, fontSize: 11, color: "white",
};

function Defects() {
  return (
    <>
      <PageHeader title="Defect Analytics" crumbs={["Home", "Defect Analytics"]} />

      {/* ── Top KPI strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total Defects",    value: "128",  sub: "Live count",        tone: "cyan",    icon: AlertTriangle },
          { label: "Critical",         value: "15",   sub: "Immediate action",  tone: "critical", icon: ShieldAlert },
          { label: "Defect Rate",      value: "1.35%",sub: "Per wafer average", tone: "warning",  icon: TrendingDown },
          { label: "Inspected Today",  value: "2,451",sub: "Wafers processed",  tone: "neon",     icon: Eye },
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

      {/* ── Middle row ── */}
      <div className="grid grid-cols-12 gap-3 mb-3">

        {/* Classification bars */}
        <Panel title="Defect Classification" className="col-span-12 lg:col-span-4"
          action={<span className="flex items-center gap-1.5 sub-text text-muted-foreground"><Filter className="size-3" /> 6 types</span>}>
          <ul className="space-y-3">
            {classes.map((c) => (
              <li key={c.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="flex items-center gap-2 row-desc-text">
                    <span className="size-2 rounded-sm" style={{ background: c.color }} />
                    {c.name}
                  </span>
                  <span className="mono-text text-muted-foreground">{c.n} <span className="text-[9px]">({c.pct}%)</span></span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${c.pct * 3.6}%`, background: c.color, boxShadow: `0 0 10px ${c.color}` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Bar chart */}
        <Panel title="Defect Count by Type" className="col-span-12 lg:col-span-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} margin={{ left: -15, right: 4, top: 4, bottom: 0 }} barSize={20}>
              <CartesianGrid stroke="oklch(0.50 0.06 240 / 0.15)" vertical={false} />
              <XAxis dataKey="name" stroke="oklch(0.70 0.03 240 / 0.5)" tick={{ fontSize: 9 }} tickLine={false} />
              <YAxis stroke="oklch(0.70 0.03 240 / 0.5)" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {barData.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        {/* Severity donut */}
        <Panel title="Severity Distribution" className="col-span-12 lg:col-span-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <DonutChart data={severityDist} />
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center">
                  <div className="text-2xl font-bold" style={{ color: "var(--cyan)", fontFamily: "Inter, sans-serif" }}>128</div>
                  <div className="sub-text text-muted-foreground">Total</div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {severityDist.map((d) => (
                <div key={d.name} className="flex items-center gap-2 row-desc-text">
                  <span className="size-2 rounded-sm" style={{ background: d.color }} />
                  <span className="text-muted-foreground w-14">{d.name}</span>
                  <span className="mono-text">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-12 gap-3">
        <Panel title="Defect Heatmap" className="col-span-12 md:col-span-6 lg:col-span-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 aspect-square max-w-[220px] mx-auto"><HeatmapBlob size={220} /></div>
            <div className="flex flex-col items-center gap-1 sub-text">
              <span className="text-muted-foreground">High</span>
              <div className="w-2.5 h-24 rounded-full" style={{ background: "linear-gradient(to bottom, oklch(0.65 0.25 25), oklch(0.78 0.18 60), oklch(0.82 0.17 200), oklch(0.40 0.10 260))" }} />
              <span className="text-muted-foreground">Low</span>
            </div>
          </div>
        </Panel>

        <Panel title="CNN Feature Map Visualization" className="col-span-12 md:col-span-6 lg:col-span-4">
          <FeatureMaps />
        </Panel>

        <Panel title="Live Defect Trend" subtitle="Rolling 60-minute window" className="col-span-12 lg:col-span-4"
          action={<Badge label="Live" tone="neon" pulse />}>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-bold" style={{ color: "var(--cyan)", fontFamily: "Inter, sans-serif" }}>128</span>
            <span className="sub-text text-muted-foreground">defects / min</span>
          </div>
          <LiveLine data={genTime(14, 130, 50)} color="var(--cyan)" height={140} />
        </Panel>
      </div>
    </>
  );
}
