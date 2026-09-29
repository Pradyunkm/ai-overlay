import { createFileRoute } from "@tanstack/react-router";
import { Panel, PageHeader, Badge } from "@/components/layout/AppShell";
import { LiveLine, ScatterPlot, DonutChart } from "@/components/viz/Charts";
import { Activity, TrendingUp, Thermometer, AlertTriangle } from "lucide-react";
import { useState, useEffect } from "react";
import { fetchProcessHealth, type ProcessHealth } from "@/lib/api/backend";

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
  const [data, setData] = useState<ProcessHealth | null>(null);

  useEffect(() => {
    fetchProcessHealth().then(setData).catch(console.error);
    const id = setInterval(() => fetchProcessHealth().then(setData).catch(console.error), 30_000);
    return () => clearInterval(id);
  }, []);

  const scatter = Array.from({ length: 80 }, (_, i) => ({
    x: (i % 20) / 2 - 5,
    y: 1 + Math.sin(i / 3) * 1.5 + Math.random() * 0.8,
    g: i % 3,
  }));

  const waferYield  = data?.wafer_yield  ?? 92.7;
  const driftScore  = data?.drift_score  ?? 18.6;
  const tempVar     = data?.temp_variation ?? 2.4;
  const oxidDelta   = data?.oxidation_delta ?? 6.8;
  const driftTrend  = data?.drift_trend?.length ? data.drift_trend : Array.from({ length: 14 }, (_, i) => ({ t: `D-${i+1}`, v: 15 + i * 0.3 }));
  const yieldTrend  = data?.yield_trend?.length ? data.yield_trend : Array.from({ length: 14 }, (_, i) => ({ t: `D-${i+1}`, v: 90 + i * 0.2 }));
  const params      = data?.parameters ?? { exposure_time: "0.82s", focus_depth: "-12 nm", stage_temp: "22.4°C", pressure: "1.02 atm", scan_speed: "120 mm/s", alignment_score: "97.6%" };

  const driftTone   = driftScore > 40 ? "critical" : driftScore > 20 ? "warning" : "neon";
  const driftColor  = driftTone === "critical" ? "var(--critical)" : driftTone === "warning" ? "var(--warning)" : "var(--neon)";

  return (
    <>
      <PageHeader title="Process Health" crumbs={["Home", "Process Health"]} />

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[
          { label: "Wafer Yield",     value: `${waferYield}%`, sub: "+2.3% vs yesterday", tone: "neon",    icon: TrendingUp },
          { label: "Drift Score",     value: `${driftScore}%`, sub: driftScore > 25 ? "High Risk" : "Medium Risk", tone: driftTone as any, icon: Activity },
          { label: "Temp Variation",  value: `+${tempVar}°C`,  sub: "Stage temperature",   tone: "cyan",    icon: Thermometer },
          { label: "Oxidation Delta", value: `${oxidDelta}%`,  sub: "Inconsistency",        tone: "critical", icon: AlertTriangle },
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
                { name: "Good Die", value: waferYield,       color: "var(--neon)" },
                { name: "Bad Die",  value: 100 - waferYield, color: "oklch(0.28 0.06 260)" },
              ]} />
              <div className="absolute inset-0 grid place-items-center pointer-events-none">
                <div className="text-center">
                  <div className="text-lg font-bold" style={{ color: "var(--neon)", fontFamily: "Inter, sans-serif" }}>{waferYield}%</div>
                  <div className="sub-text text-muted-foreground">Good</div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div><div className="sub-text text-muted-foreground">Good Die</div><div className="row-name-text" style={{ color: "var(--neon)" }}>8,742</div></div>
              <div><div className="sub-text text-muted-foreground">Total Die</div><div className="row-name-text">9,445</div></div>
            </div>
          </div>
          <LiveLine data={yieldTrend} color="var(--neon)" height={120} />
        </Panel>

        {/* Process drift */}
        <Panel title="Process Drift Analysis" className="col-span-12 lg:col-span-4"
          action={<Badge label={driftScore > 25 ? "High Risk" : "Medium Risk"} tone={driftTone as any} />}>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="value-text" style={{ color: driftColor }}>{driftScore}%</span>
            <span className="sub-text text-muted-foreground">Drift Score</span>
          </div>
          <LiveLine data={driftTrend} color={driftColor} height={180} />
        </Panel>

        {/* Oxidation correlation */}
        <Panel title="Oxidation Process Correlation" className="col-span-12 lg:col-span-4">
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="glass-strong rounded-lg p-2.5">
              <div className="sub-text text-muted-foreground mb-1">Temperature Var.</div>
              <div className="text-xl font-bold" style={{ color: "var(--cyan)", fontFamily: "Inter, sans-serif" }}>+{tempVar}°C</div>
            </div>
            <div className="glass-strong rounded-lg p-2.5">
              <div className="sub-text text-muted-foreground mb-1">Oxidation Δ</div>
              <div className="text-xl font-bold" style={{ color: "var(--critical)", fontFamily: "Inter, sans-serif" }}>{oxidDelta}%</div>
            </div>
          </div>
          <ScatterPlot data={scatter} />
        </Panel>
      </div>

      {/* ── Bottom: Trend & logs ── */}
      <div className="grid grid-cols-12 gap-3">
        <Panel title="Trend & Drift Analysis" subtitle="30-day rolling window" className="col-span-12 lg:col-span-8">
          <LiveLine data={driftTrend} color="var(--cyan)" height={180} />
        </Panel>

        <Panel title="Process Parameters" className="col-span-12 lg:col-span-4">
          <ul className="divide-y divide-border/60 -mx-3">
            {[
              { k: "Exposure Time",   v: params.exposure_time,   t: "neon" },
              { k: "Focus Depth",     v: params.focus_depth,     t: "cyan" },
              { k: "Stage Temp",      v: params.stage_temp,      t: "warning" },
              { k: "Pressure",        v: params.pressure,        t: "cyan" },
              { k: "Scan Speed",      v: params.scan_speed,      t: "neon" },
              { k: "Alignment Score", v: params.alignment_score, t: "neon" },
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
