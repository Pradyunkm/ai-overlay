import { createFileRoute } from "@tanstack/react-router";
import { Panel, Badge } from "@/components/layout/AppShell";
import { HeatmapBlob, WaferGrid } from "@/components/viz/WaferMap";
import { LiveLine, genTime, DonutChart } from "@/components/viz/Charts";
import { useState, useRef, useEffect } from "react";
import {
  CheckCircle2, ExternalLink, Activity,
  TrendingUp, ShieldAlert, RotateCcw, Crosshair,
  AlertTriangle, ShieldCheck, Clock, Zap,
  UploadCloud, Camera, Play, Square, Lightbulb,
  Thermometer, RefreshCcw, FlaskConical, GitCompare,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  LineChart, Line, Tooltip, ScatterChart, Scatter, Cell, CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/_app/")(
  { head: () => ({ meta: [{ title: "SDF Overlay Inspection — Dashboard" }] }), component: Dashboard }
);

/* ─── palette helper ─── */
function tc(tone: string) {
  return tone === "neon" ? "var(--neon)"
    : tone === "warning" ? "var(--warning)"
    : tone === "violet" ? "var(--violet)"
    : tone === "critical" ? "var(--critical)"
    : "var(--cyan)";
}

/* ─── static data ─── */
const kpis = [
  { label: "Overlay Shift",           value: "3.42", unit: "nm", sub: "X: 2.18 nm  ·  Y: −2.64 nm", tone: "cyan",    icon: Crosshair },
  { label: "Rotational Misalignment", value: "0.23", unit: "°",  sub: "Within tolerance",             tone: "warning", icon: RotateCcw },
  { label: "Edge Placement Error",    value: "3.12", unit: "nm", sub: "High Confidence",              tone: "violet",  icon: AlertTriangle },
  { label: "Alignment Confidence",    value: "97.6", unit: "%",  sub: "High Confidence",              tone: "neon",    icon: ShieldCheck },
  { label: "Defect Severity",         value: "High", unit: "",   sub: "Score: 8.7 / 10",              tone: "warning", icon: Zap },
  { label: "AI Inference Time",       value: "0.82", unit: "s",  sub: "RTX 3050",                     tone: "neon",    icon: Clock },
];

const pipelineSteps = [
  { n: 1, name: "Input Image",            desc: "Original wafer image",                    time: "0.00s" },
  { n: 2, name: "Grayscale Conversion",   desc: "Convert to grayscale",                    time: "0.33s" },
  { n: 3, name: "Noise Reduction (Blur)", desc: "Remove noise and high-frequency noise",   time: "0.05s" },
  { n: 4, name: "Edge Detection (Canny)", desc: "Detect edges and boundaries",             time: "0.12s" },
  { n: 5, name: "Contour Extraction",     desc: "Extract contours and shapes",             time: "0.15s" },
  { n: 6, name: "Overlay Comparison",     desc: "Compare reference vs test wafer",         time: "0.18s" },
  { n: 7, name: "Heatmap Generation",     desc: "Generate error intensity heatmap",        time: "0.20s" },
  { n: 8, name: "CNN Feature Map",        desc: "AI feature attention visualization",      time: "0.28s" },
];

const driftData = genTime(12, 18, 10);
const riskData  = genTime(8, 18, 8);
const yieldTrend = Array.from({ length: 20 }, (_, i) => ({
  t: `Day ${i + 1}`,
  v: Math.round(88 + Math.sin(i * 0.4) * 4 + i * 0.22),
}));

const oxData = Array.from({ length: 28 }, (_, i) => ({
  x: -6 + i * 0.43,
  y: -1 + Math.sin(i * 0.5) * 3 + (Math.random() - 0.5) * 1.5,
  g: i % 3,
}));

const recommendations = [
  { title: "Recalibrate Alignment System", desc: "Overlay shift exceeds 3nm threshold. Immediate recalibration required.", tone: "warning", icon: RefreshCcw, action: "Calibrate Now" },
  { title: "Optimize Exposure Dose",        desc: "Edge Placement Error at 3.12nm — above 2.5nm spec limit.",             tone: "warning", icon: Zap,        action: "Adjust Dose" },
  { title: "Stabilize Stage Temperature",   desc: "Temperature variation +2.4°C detected — impacts overlay accuracy.",   tone: "cyan",    icon: Thermometer, action: "Check HVAC" },
  { title: "Review Defect Density Zone",    desc: "High defect concentration detected in upper-right wafer quadrant.",  tone: "critical", icon: AlertTriangle,action: "Open Map" },
  { title: "Update CNN Model Weights",      desc: "Model last updated 48h ago — newer checkpoint available.",           tone: "cyan",    icon: FlaskConical, action: "Update" },
  { title: "Schedule Preventive Maintenance",desc:"Predictive risk at 18.3% — maintenance recommended within 24h.",    tone: "cyan",    icon: Lightbulb,   action: "Schedule" },
];

const chartGrid  = "oklch(0.50 0.06 240 / 0.15)";
const chartAxis  = "oklch(0.70 0.03 240 / 0.5)";
const tipStyle   = {
  background: "oklch(0.18 0.04 260 / 0.95)",
  border: "1px solid oklch(0.78 0.18 200 / 0.3)",
  borderRadius: 6, fontSize: 11, color: "white",
};

/* ══════════════════════════════════════════════ */
export default function Dashboard() {
  const [sel, setSel] = useState<typeof pipelineSteps[number] | null>(pipelineSteps[1]);
  const [uploadMode, setUploadMode] = useState<"upload" | "webcam" | "compare">("upload");
  const [uploadReady, setUploadReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-4">

        {/* ══ QUICK UPLOAD BAR ══ */}
        <QuickUploadBar
          mode={uploadMode}
          setMode={setUploadMode}
          ready={uploadReady}
          setReady={setUploadReady}
          dragging={dragging}
          setDragging={setDragging}
          fileRef={fileRef}
        />

        {/* ══ KPI STRIP ══ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {kpis.map((k) => {
            const color = tc(k.tone);
            const Icon  = k.icon;
            return (
              <div
                key={k.label}
                className="glass rounded-xl p-4 flex flex-col gap-3 hover:glow-cyan transition-all cursor-default group"
                style={{ borderTop: `2px solid ${color}` }}
              >
                {/* icon + label row */}
                <div className="flex items-center justify-between">
                  <span className="label-text text-muted-foreground">{k.label}</span>
                  <div
                    className="size-7 rounded-lg grid place-items-center"
                    style={{ background: `color-mix(in oklab, ${color} 12%, transparent)`, border: `1px solid color-mix(in oklab, ${color} 30%, transparent)` }}
                  >
                    <Icon className="size-3.5" style={{ color }} />
                  </div>
                </div>

                {/* big value */}
                <div className="flex items-baseline gap-1">
                  <span className="value-text" style={{ color }}>{k.value}</span>
                  {k.unit && <span className="unit-text text-muted-foreground">{k.unit}</span>}
                </div>

                {/* subtext */}
                <div className="sub-text text-muted-foreground border-t border-border/40 pt-2 truncate">
                  {k.sub}
                </div>
              </div>
            );
          })}
        </div>

        {/* ══ MIDDLE ROW ══ */}
        <div className="grid grid-cols-12 gap-3">

          {/* Pipeline table – 7 cols */}
          <div className="col-span-12 lg:col-span-7">
            <section className="glass rounded-xl overflow-hidden h-full">
              <header className="flex items-center justify-between px-5 py-3 border-b border-border/60">
                <div>
                  <h3 className="section-title">Step-by-Step Process Pipeline</h3>
                  <p className="sub-text text-muted-foreground mt-0.5">Click on any step to view detailed output and metrics</p>
                </div>
                <Badge label="Total: 0.81s" tone="neon" />
              </header>

              {/* table head */}
              <div className="grid pipeline-cols px-5 py-2 border-b border-border/40">
                {["#", "Step Name", "Description", "Status", "Time", "Action"].map((h) => (
                  <div key={h} className="col-label-text text-muted-foreground">{h}</div>
                ))}
              </div>

              {/* rows */}
              {pipelineSteps.map((s) => {
                const active = sel?.n === s.n;
                return (
                  <div key={s.n}>
                    <div
                      onClick={() => setSel(active ? null : s)}
                      className={`grid pipeline-cols px-5 py-3 border-b border-border/30 cursor-pointer transition-colors ${
                        active ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-white/[0.025]"
                      }`}
                    >
                      {/* # */}
                      <div className="mono-text text-primary">{s.n}</div>
                      {/* name */}
                      <div className="row-name-text">{s.name}</div>
                      {/* desc */}
                      <div className="row-desc-text text-muted-foreground">{s.desc}</div>
                      {/* status */}
                      <div className="flex items-center gap-1.5 text-[color:var(--neon)]">
                        <CheckCircle2 className="size-3 shrink-0" />
                        <span className="status-text">Completed</span>
                      </div>
                      {/* time */}
                      <div className="mono-text text-muted-foreground">{s.time}</div>
                      {/* action */}
                      <div>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSel(active ? null : s); }}
                          className="open-btn"
                          style={{ color: "var(--cyan)", borderColor: "color-mix(in oklab, var(--cyan) 35%, transparent)" }}
                        >
                          {active ? "CLOSE" : "OPEN"}
                        </button>
                      </div>
                    </div>

                    {active && (
                      <div className="bg-panel-2/30 border-y border-border/40 p-4 flex flex-col sm:flex-row gap-4 animate-fade-in">
                        {/* Left: preview */}
                        <div className="flex flex-col gap-2 shrink-0">
                          <div className="relative rounded-lg overflow-hidden size-32 scanline glass-strong">
                            <StepVisual step={s.n} />
                          </div>
                          <div className="flex gap-1">
                            <button className="flex-1 py-1 px-2 rounded bg-primary/20 border border-primary/30 text-primary text-[10px] font-medium hover:bg-primary/30 transition">Compare</button>
                            <button className="flex-1 py-1 px-2 rounded bg-primary text-primary-foreground text-[10px] font-medium hover:opacity-90 transition">Download</button>
                          </div>
                        </div>
                        {/* Right: Description & Metrics */}
                        <div className="flex-1 flex flex-col gap-2 min-w-0">
                          <div>
                            <h4 className="row-name-text text-primary">Step {s.n} Details</h4>
                            <p className="row-desc-text text-muted-foreground mt-0.5">{s.desc}</p>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mt-1">
                            {[
                              ["Mean Intensity", "127.43"],
                              ["Image Size", "2048 × 2048"],
                              ["Std Dev", "42.18"],
                              ["Dynamic Range", "0 – 255"],
                            ].map(([k, v]) => (
                              <div key={k} className="glass rounded-lg p-2 border border-border/20">
                                <div className="sub-text text-muted-foreground">{k}</div>
                                <div className="text-[11px] font-bold text-foreground mt-0.5">{v}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          </div>

          {/* Right column – 5 cols */}
          <div className="col-span-12 lg:col-span-5 flex flex-col gap-3">

            {/* Overlay Error Heatmap */}
            <section className="glass rounded-xl overflow-hidden">
              <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
                <h3 className="section-title">Overlay Error Heatmap</h3>
                <Badge label="Live" tone="neon" pulse />
              </header>
              <div className="p-4 flex items-center gap-4">
                <div className="flex-1 aspect-square max-w-[130px]"><HeatmapBlob size={130} /></div>
                <ColorBar labels={["High Error", "Low Error"]} />
              </div>
            </section>

            {/* Defect Density Map */}
            <section className="glass rounded-xl overflow-hidden">
              <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
                <h3 className="section-title">Defect Density Map</h3>
              </header>
              <div className="p-4 flex items-center gap-4">
                <div className="flex-1 aspect-square max-w-[130px]"><HeatmapBlob size={130} /></div>
                <ColorBar labels={["High Density", "Low Density"]} />
              </div>
            </section>

            {/* Wafer Yield Prediction */}
            <section className="glass rounded-xl overflow-hidden">
              <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
                <h3 className="section-title">Wafer Yield Prediction</h3>
                <Badge label="+2.3% vs yesterday" tone="neon" />
              </header>
              <div className="p-3">
                <div className="flex items-center gap-4 mb-2">
                  <div className="relative w-[80px] h-[80px] shrink-0">
                    <DonutChart data={[
                      { name: "Good Die", value: 92.7, color: "var(--neon)" },
                      { name: "Bad Die",  value: 7.3,  color: "oklch(0.28 0.06 260)" },
                    ]} />
                    <div className="absolute inset-0 grid place-items-center pointer-events-none">
                      <div className="text-center">
                        <div className="text-sm font-bold" style={{ color: "var(--neon)", fontFamily: "Inter, sans-serif" }}>92.7%</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div><div className="sub-text text-muted-foreground">Good Die</div><div className="row-name-text" style={{ color: "var(--neon)" }}>8,742</div></div>
                    <div><div className="sub-text text-muted-foreground">Total Die</div><div className="row-name-text">9,445</div></div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={80}>
                  <AreaChart data={yieldTrend} margin={{ left: -20, right: 4, top: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--neon)" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="var(--neon)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={chartGrid} vertical={false} />
                    <XAxis dataKey="t" stroke={chartAxis} tick={{ fontSize: 8 }} tickLine={false} interval={4} />
                    <YAxis stroke={chartAxis} tick={{ fontSize: 8 }} tickLine={false} axisLine={false} domain={[85, 97]} />
                    <Tooltip contentStyle={tipStyle} formatter={(v: number) => [`${v}%`, "Yield"]} />
                    <Area dataKey="v" stroke="var(--neon)" strokeWidth={2} fill="url(#yieldGrad)" type="monotone" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>
        </div>

        {/* ══ BOTTOM ROW ══ */}
        <div className="grid grid-cols-12 gap-3">

          {/* Real-Time Defect Counter */}
          <section className="col-span-12 lg:col-span-3 glass rounded-xl overflow-hidden">
            <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
              <h3 className="section-title">Real-Time Defect Counter</h3>
              <Badge label="Live" tone="neon" pulse />
            </header>
            <div className="p-4">
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-5xl font-bold" style={{ color: "var(--cyan)", fontFamily: "Inter, sans-serif" }}>128</span>
                <span className="sub-text text-muted-foreground">defects / min</span>
              </div>
              <LiveLine data={genTime(12, 130, 50)} color="var(--cyan)" height={100} />
            </div>
          </section>

          {/* Process Drift Analysis */}
          <section className="col-span-12 lg:col-span-3 glass rounded-xl overflow-hidden">
            <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
              <h3 className="section-title">Process Drift Analysis</h3>
            </header>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="size-3.5" style={{ color: "var(--warning)" }} />
                <span className="row-desc-text" style={{ color: "var(--warning)" }}>Drift Score: <strong>18.6%</strong></span>
                <span className="sub-text text-muted-foreground">· Medium Risk</span>
              </div>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={driftData} margin={{ left: -15, right: 4, top: 4, bottom: 0 }}>
                  <CartesianGrid stroke={chartGrid} vertical={false} />
                  <XAxis dataKey="t" stroke={chartAxis} tick={{ fontSize: 9 }} tickLine={false} />
                  <YAxis stroke={chartAxis} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tipStyle} />
                  <Line dataKey="v" stroke="var(--warning)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Oxidation Process Correlation */}
          <section className="col-span-12 lg:col-span-3 glass rounded-xl overflow-hidden">
            <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
              <h3 className="section-title">Oxidation Process Correlation</h3>
            </header>
            <div className="p-4">
              <div className="flex gap-4 mb-3">
                <MiniKV label="Temp Variation" value="+2.4°C" color="var(--warning)" />
                <MiniKV label="Oxidation Inconsistency" value="6.8%" color="var(--cyan)" />
              </div>
              <ResponsiveContainer width="100%" height={100}>
                <ScatterChart margin={{ left: -15, right: 4, top: 4, bottom: 12 }}>
                  <CartesianGrid stroke={chartGrid} />
                  <XAxis type="number" dataKey="x" stroke={chartAxis} tick={{ fontSize: 9 }}
                    label={{ value: "Temperature (°C)", position: "insideBottom", offset: -8, fill: chartAxis, fontSize: 9 }} />
                  <YAxis type="number" dataKey="y" stroke={chartAxis} tick={{ fontSize: 9 }} />
                  <Tooltip contentStyle={tipStyle} />
                  <Scatter data={oxData}>
                    {oxData.map((d, i) => (
                      <Cell key={i} fill={["var(--cyan)", "var(--warning)", "var(--neon)"][d.g]} opacity={0.75} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Predictive Failure Risk */}
          <section className="col-span-12 lg:col-span-3 glass rounded-xl overflow-hidden">
            <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
              <h3 className="section-title">Predictive Failure Risk</h3>
            </header>
            <div className="p-4 flex items-center gap-3">
              <div className="relative w-[90px] h-[90px] shrink-0">
                <DonutChart data={[
                  { name: "Risk", value: 18.3, color: "var(--warning)" },
                  { name: "Safe", value: 81.7, color: "oklch(0.28 0.06 260)" },
                ]} />
                <div className="absolute inset-0 grid place-items-center pointer-events-none">
                  <div className="text-center">
                    <div className="text-base font-bold" style={{ color: "var(--warning)", fontFamily: "Inter, sans-serif" }}>18.3%</div>
                    <div className="sub-text text-muted-foreground">Med Risk</div>
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1 mb-2">
                  <ShieldAlert className="size-3.5" style={{ color: "var(--warning)" }} />
                  <span className="row-desc-text" style={{ color: "var(--warning)" }}>Medium Risk</span>
                </div>
                <LiveLine data={riskData} color="var(--warning)" height={80} />
              </div>
            </div>
          </section>
        </div>

        {/* ══ SMART RECOMMENDATIONS ══ */}
        <section className="glass rounded-xl overflow-hidden">
          <header className="flex items-center justify-between px-5 py-3 border-b border-border/60">
            <div>
              <h3 className="section-title">Smart Recommendation Engine</h3>
              <p className="sub-text text-muted-foreground mt-0.5">AI-generated actions based on current process state</p>
            </div>
            <button className="flex items-center gap-1.5 text-primary hover:glow-cyan transition px-3 py-1.5 rounded-lg border border-primary/40"
              style={{ fontSize: 11, fontFamily: "Inter, sans-serif", fontWeight: 500 }}>
              View All <ExternalLink className="size-3" />
            </button>
          </header>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {recommendations.map((r) => {
              const col = tc(r.tone);
              const Icon = r.icon;
              const badgeTone = r.tone === "warning" ? "warning" : r.tone === "critical" ? "critical" : "cyan";
              const badgeLabel = r.tone === "warning" ? "High" : r.tone === "critical" ? "Critical" : "Medium";
              return (
                <div key={r.title} className="glass-strong rounded-xl p-4 flex flex-col gap-3 hover:glow-cyan transition-all"
                  style={{ borderLeft: `3px solid ${col}` }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="size-8 rounded-lg grid place-items-center shrink-0"
                        style={{ background: `color-mix(in oklab, ${col} 12%, transparent)`, border: `1px solid color-mix(in oklab, ${col} 30%, transparent)` }}>
                        <Icon className="size-4" style={{ color: col }} />
                      </div>
                      <div className="row-name-text leading-snug">{r.title}</div>
                    </div>
                    <Badge label={badgeLabel} tone={badgeTone} />
                  </div>
                  <div className="sub-text text-muted-foreground leading-relaxed">{r.desc}</div>
                  <button className="mt-auto self-start px-3 py-1.5 rounded-lg border row-desc-text font-medium transition hover:glow-cyan"
                    style={{ color: col, borderColor: `color-mix(in oklab, ${col} 35%, transparent)`, fontFamily: "Inter, sans-serif" }}>
                    {r.action} →
                  </button>
                </div>
              );
            })}
          </div>
        </section>
    </div>
  );
}



/* ── small helpers ── */
function ColorBar({ labels }: { labels: [string, string] }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="sub-text text-muted-foreground">{labels[0]}</span>
      <div className="w-3 h-24 rounded-full" style={{ background: "linear-gradient(to bottom, oklch(0.65 0.25 25), oklch(0.78 0.18 60), oklch(0.82 0.17 200), oklch(0.40 0.10 260))" }} />
      <span className="sub-text text-muted-foreground">{labels[1]}</span>
    </div>
  );
}

function YieldStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="sub-text text-muted-foreground">{label}</div>
      <div className="text-lg font-bold mt-0.5" style={{ color, fontFamily: "Inter, sans-serif" }}>{value}</div>
    </div>
  );
}

function MiniKV({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div className="sub-text text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold" style={{ color, fontFamily: "Inter, sans-serif" }}>{value}</div>
    </div>
  );
}

function StepVisual({ step }: { step: number }) {
  if (step === 7 || step === 6) return <HeatmapBlob size={260} />;
  if (step === 4 || step === 5) {
    return (
      <svg viewBox="0 0 260 260" className="w-full h-full">
        <rect width="260" height="260" fill="oklch(0.08 0.02 260)" />
        {Array.from({ length: 30 }).map((_, i) => (
          <rect key={i} x={10 + (i % 6) * 41} y={10 + Math.floor(i / 6) * 49} width={35} height={40}
            fill="none" stroke="oklch(0.95 0.05 200)" strokeWidth="1" opacity={0.7} />
        ))}
      </svg>
    );
  }
  return <WaferGrid size={260} defects={step >= 6} />;
}

/* ══ QUICK UPLOAD BAR ══════════════════════════════════════════════ */
const models = [
  {
    id: "yolo",
    name: "YOLO (Fast)",
    type: "Real-time Defect Detection",
    accuracy: "97.4%",
    defaultMode: "Full Analysis"
  },
  {
    id: "unet",
    name: "U-Net (Pro)",
    type: "Deep Pixel Segmentation",
    accuracy: "99.2%",
    defaultMode: "Deep Analysis"
  }
];

const nodes = [
  "2nm (GAA)",
  "3nm (EUV)",
  "5nm (EUV)",
  "7nm (DUV)",
  "10nm (DUV)"
];

const layers = [
  "Metal Interconnect",
  "Polysilicon Gate",
  "Active Oxide",
  "Via Contact",
  "Photoresist Target"
];

type UploadMode = "upload" | "webcam" | "compare";

function QuickUploadBar({ mode, setMode, ready, setReady, dragging, setDragging, fileRef }: {
  mode: UploadMode; setMode: (m: UploadMode) => void;
  ready: boolean; setReady: (v: boolean) => void;
  dragging: boolean; setDragging: (v: boolean) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
}) {
  const tabs: { k: UploadMode; label: string; icon: React.ElementType }[] = [
    { k: "upload",  label: "Upload Image",    icon: UploadCloud },
    { k: "webcam",  label: "Live Webcam",     icon: Camera },
    { k: "compare", label: "Comparison Mode", icon: GitCompare },
  ];

  // Selected values
  const [selectedNode, setSelectedNode] = useState(nodes[3]); // 7nm (DUV)
  const [selectedLayer, setSelectedLayer] = useState(layers[0]); // Metal Interconnect
  const [selectedModel, setSelectedModel] = useState(models[0]); // YOLO (Fast)

  // Dropdown open states
  const [nodeOpen, setNodeOpen] = useState(false);
  const [layerOpen, setLayerOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setNodeOpen(false);
        setLayerOpen(false);
        setModelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleModelSelect = (m: typeof models[number]) => {
    setSelectedModel(m);
    setModelOpen(false);
  };

  return (
    <section className="glass rounded-xl">
      <header className="flex items-center justify-between px-5 py-2.5 border-b border-border/60 rounded-t-xl">
        <h3 className="section-title">Quick Upload &amp; Analysis</h3>
        {ready && <Badge label="Ready to Analyse" tone="neon" pulse />}
      </header>
      <div className="p-4 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-5">
          {mode === "upload" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) setReady(true); }}
              onClick={() => fileRef.current?.click()}
              className={`relative rounded-xl border-2 border-dashed cursor-pointer transition-all h-[160px] grid place-items-center text-center overflow-hidden ${dragging ? "border-primary bg-primary/10 glow-cyan" : ready ? "border-[color:var(--neon)] bg-[color:var(--neon)]/5" : "border-border/60 hover:border-primary/50 hover:bg-primary/5"}`}
            >
              <div className="absolute inset-x-0 top-0 h-px shimmer" />
              <div className="relative flex flex-col items-center gap-2">
                <div className={`size-12 rounded-full glass-strong grid place-items-center transition ${ready ? "glow-neon" : "glow-cyan"}`}>
                  {ready ? <CheckCircle2 className="size-5" style={{ color: "var(--neon)" }} /> : <UploadCloud className="size-5 text-primary" />}
                </div>
                <div className="row-name-text">{ready ? "File Ready — Click to Replace" : "Drop Wafer Image Here"}</div>
                <div className="sub-text text-muted-foreground">{ready ? "wafer_scan.png" : "JPG · PNG · TIFF · BMP — max 50 MB"}</div>
              </div>
              <input ref={fileRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.tiff,.tif,.bmp" onChange={(e) => { if (e.target.files?.length) setReady(true); }} />
            </div>
          )}
          {mode === "webcam" && (
            <div className="relative rounded-xl overflow-hidden h-[160px] glass-strong scanline">
              <div className="absolute inset-0 grid-bg opacity-40" />
              <div className="absolute inset-5 border border-primary/40 rounded-lg">
                <CornerBracket pos="tl" /><CornerBracket pos="tr" /><CornerBracket pos="bl" /><CornerBracket pos="br" />
                <div className="absolute inset-0 grid place-items-center"><Crosshair className="size-8 text-primary/60" /></div>
              </div>
              <div className="absolute bottom-2 left-3 mono-text text-primary/80">CAM-01 · 1920×1080 · 60fps</div>
              <div className="absolute top-2 right-2 flex gap-1.5">
                <button className="px-2.5 py-1 rounded-lg glass row-desc-text flex items-center gap-1.5" style={{ color: "var(--cyan)" }}><Camera className="size-3" /> Capture</button>
                <button className="px-2.5 py-1 rounded-lg glass row-desc-text flex items-center gap-1.5 text-muted-foreground"><Square className="size-2.5" /> Stop</button>
              </div>
            </div>
          )}
          {mode === "compare" && <CompareZone />}
        </div>
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-3">
          <div className="glass-strong rounded-xl p-1 flex gap-1">
            {tabs.map((t) => { const Icon = t.icon; const active = mode === t.k; return (
              <button key={t.k} onClick={() => setMode(t.k)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-all row-desc-text ${active ? "bg-primary/15 text-primary border border-primary/30 glow-cyan" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className="size-3.5 shrink-0" /><span className="hidden sm:inline">{t.label}</span>
              </button>
            ); })}
          </div>
          <div className="grid grid-cols-2 gap-2 flex-1" ref={containerRef}>
            {/* Process Node */}
            <div className="relative">
              <label className="col-label-text text-muted-foreground block mb-1">Process Node</label>
              <div
                onClick={() => {
                  setNodeOpen(!nodeOpen);
                  setLayerOpen(false);
                  setModelOpen(false);
                }}
                className={`glass-strong rounded-lg px-3 py-2 flex items-center justify-between cursor-pointer transition-all border ${
                  nodeOpen ? "border-primary glow-cyan" : "border-transparent hover:border-primary/40"
                }`}
              >
                <span className="row-desc-text text-foreground">{selectedNode}</span>
                <span className={`text-muted-foreground text-[10px] transition-transform duration-200 ${nodeOpen ? "rotate-180 text-primary" : ""}`}>
                  ▼
                </span>
              </div>
              {nodeOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-popover rounded-lg border border-border/80 overflow-hidden shadow-xl max-h-48 overflow-y-auto animate-fade-in">
                  <div className="p-1 flex flex-col gap-1">
                    {nodes.map((node) => {
                      const active = selectedNode === node;
                      return (
                        <div
                          key={node}
                          onClick={() => {
                            setSelectedNode(node);
                            setNodeOpen(false);
                          }}
                          className={`p-2 rounded cursor-pointer transition-all text-left text-[11px] ${
                            active
                              ? "bg-primary/20 text-primary font-semibold"
                              : "hover:bg-white/[0.04] text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {node}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Layer Type */}
            <div className="relative">
              <label className="col-label-text text-muted-foreground block mb-1">Layer Type</label>
              <div
                onClick={() => {
                  setLayerOpen(!layerOpen);
                  setNodeOpen(false);
                  setModelOpen(false);
                }}
                className={`glass-strong rounded-lg px-3 py-2 flex items-center justify-between cursor-pointer transition-all border ${
                  layerOpen ? "border-primary glow-cyan" : "border-transparent hover:border-primary/40"
                }`}
              >
                <span className="row-desc-text text-foreground">{selectedLayer}</span>
                <span className={`text-muted-foreground text-[10px] transition-transform duration-200 ${layerOpen ? "rotate-180 text-primary" : ""}`}>
                  ▼
                </span>
              </div>
              {layerOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-popover rounded-lg border border-border/80 overflow-hidden shadow-xl max-h-48 overflow-y-auto animate-fade-in">
                  <div className="p-1 flex flex-col gap-1">
                    {layers.map((layer) => {
                      const active = selectedLayer === layer;
                      return (
                        <div
                          key={layer}
                          onClick={() => {
                            setSelectedLayer(layer);
                            setLayerOpen(false);
                          }}
                          className={`p-2 rounded cursor-pointer transition-all text-left text-[11px] ${
                            active
                              ? "bg-primary/20 text-primary font-semibold"
                              : "hover:bg-white/[0.04] text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {layer}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Analysis Mode */}
            <div className="relative">
              <label className="col-label-text text-muted-foreground block mb-1">Analysis Mode</label>
              <div className="glass-strong rounded-lg px-3 py-2 flex items-center justify-between border border-transparent select-none">
                <span className="row-desc-text text-foreground font-medium">
                  {selectedModel.id === "yolo" ? "Full Analysis" : "Deep Analysis"}
                </span>
                <span className="text-[10px] text-primary/80 font-mono tracking-wider">AUTO</span>
              </div>
            </div>

            {/* AI Model */}
            <div className="relative">
              <label className="col-label-text text-muted-foreground block mb-1">AI Model</label>
              <div
                onClick={() => {
                  setModelOpen(!modelOpen);
                  setNodeOpen(false);
                  setLayerOpen(false);
                }}
                className={`glass-strong rounded-lg px-3 py-2 flex items-center justify-between cursor-pointer transition-all border ${
                  modelOpen ? "border-primary glow-cyan" : "border-transparent hover:border-primary/40"
                }`}
              >
                <span className="row-desc-text text-foreground">{selectedModel.name}</span>
                <span className={`text-muted-foreground text-[10px] transition-transform duration-200 ${modelOpen ? "rotate-180 text-primary" : ""}`}>
                  ▼
                </span>
              </div>

              {modelOpen && (
                <div className="absolute z-50 left-0 right-0 mt-1 bg-popover rounded-lg border border-border/80 overflow-hidden shadow-xl animate-fade-in">
                  <div className="p-1 flex flex-col gap-1">
                    {models.map((m) => {
                      const active = selectedModel.id === m.id;
                      return (
                        <div
                          key={m.id}
                          onClick={() => handleModelSelect(m)}
                          className={`p-2 rounded cursor-pointer transition-all flex flex-col text-left ${
                            active
                              ? "bg-primary/20 border border-primary/30 glow-cyan text-primary"
                              : "hover:bg-white/[0.04] text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold">{m.name}</span>
                            <span className="text-[9px] font-mono opacity-80">{m.accuracy} Acc</span>
                          </div>
                          <span className="text-[9px] opacity-60 mt-0.5">{m.type}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
          <button className="w-full py-3 rounded-xl flex items-center justify-center gap-2 tracking-wide transition-all hover:opacity-90 hover:glow-cyan"
            style={{ background: "linear-gradient(135deg, var(--primary), var(--neon))", color: "oklch(0.12 0.03 260)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13 }}>
            <Play className="size-4" fill="currentColor" /> START ANALYSIS
          </button>
        </div>
      </div>
    </section>
  );
}

function CompareZone() {
  const [pos, setPos] = useState(50);
  return (
    <div className="relative rounded-xl overflow-hidden h-[160px] glass-strong">
      <div className="absolute inset-0 grid place-items-center"><WaferGrid size={320} defects={false} /></div>
      <div className="absolute inset-0 grid place-items-center" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}><WaferGrid size={320} /></div>
      <div className="absolute top-0 bottom-0 w-px bg-primary glow-cyan" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-6 rounded-full bg-primary text-primary-foreground grid place-items-center text-[10px]">↔</div>
      </div>
      <div className="absolute top-2 left-2"><Badge label="REF" tone="cyan" /></div>
      <div className="absolute top-2 right-2"><Badge label="TEST" tone="violet" /></div>
      <input type="range" min={0} max={100} value={pos} onChange={(e) => setPos(+e.target.value)} className="absolute bottom-2 left-4 right-4 accent-[color:var(--cyan)]" />
    </div>
  );
}

function CornerBracket({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const cls = { tl: "top-0 left-0 border-t-2 border-l-2", tr: "top-0 right-0 border-t-2 border-r-2", bl: "bottom-0 left-0 border-b-2 border-l-2", br: "bottom-0 right-0 border-b-2 border-r-2" }[pos];
  return <span className={`absolute size-3 border-primary ${cls}`} />;
}
