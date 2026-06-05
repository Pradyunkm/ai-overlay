import { createFileRoute } from "@tanstack/react-router";
import { Panel, PageHeader, Badge } from "@/components/layout/AppShell";
import { useState } from "react";
import { X, Download, ZoomIn, ZoomOut, GitCompare, Sparkles } from "lucide-react";
import { HeatmapBlob, FeatureMaps, WaferGrid } from "@/components/viz/WaferMap";
import { LiveLine, genTime } from "@/components/viz/Charts";

export const Route = createFileRoute("/_app/steps")({
  head: () => ({ meta: [{ title: "Step-by-Step Output — SDF" }] }),
  component: Steps,
});

const steps = [
  { n: 2, name: "Grayscale Conversion", desc: "Convert RGB wafer image to single-channel intensity map.", time: "0.04s" },
  { n: 3, name: "Noise Reduction (Blur)", desc: "Gaussian blur with σ=1.4 to suppress sensor noise.", time: "0.06s" },
  { n: 4, name: "Edge Detection (Canny)", desc: "Multi-stage Canny operator (low=80, high=180).", time: "0.11s" },
  { n: 5, name: "Contour Extraction", desc: "Identify die boundaries and structural contours.", time: "0.09s" },
  { n: 6, name: "Overlay Comparison", desc: "Pixel-aligned diff between reference and test wafer.", time: "0.18s" },
  { n: 7, name: "Heatmap Generation", desc: "Generate density heatmap of accumulated deviations.", time: "0.13s" },
  { n: 8, name: "CNN Feature Map Visualization", desc: "Inspect activations from CNN-Overlay v2.3.1.", time: "0.31s" },
];

function Steps() {
  const [open, setOpen] = useState<(typeof steps)[number] | null>(null);
  return (
    <>
      <PageHeader title="Step-by-Step Output" crumbs={["Home", "Pipeline", "Workflow Viewer"]} />
      <Panel title="Inspection Pipeline" subtitle="7-step processing workflow · Wafer #2451" action={<Badge label="ALL COMPLETED" tone="neon" pulse />}>
        <div className="divide-y divide-border/60 -m-4">
          <div className="grid grid-cols-12 px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <div className="col-span-1">#</div>
            <div className="col-span-4">Step</div>
            <div className="col-span-4">Description</div>
            <div className="col-span-1">Time</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-1 text-right">Action</div>
          </div>
          {steps.map((s) => (
            <div key={s.n} className="grid grid-cols-12 items-center px-4 py-3.5 text-[12px] hover:bg-primary/5 transition group">
              <div className="col-span-1 font-display text-primary">{String(s.n).padStart(2, "0")}</div>
              <div className="col-span-4 font-display tracking-wide">{s.name}</div>
              <div className="col-span-4 text-muted-foreground">{s.desc}</div>
              <div className="col-span-1 font-mono text-[color:var(--neon)]">{s.time}</div>
              <div className="col-span-1"><Badge label="Done" tone="neon" pulse /></div>
              <div className="col-span-1 text-right">
                <button onClick={() => setOpen(s)} className="px-3 py-1.5 rounded-md border border-primary/40 text-primary text-[11px] tracking-wider font-display hover:glow-cyan transition">
                  OPEN
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {open && <StepModal step={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function StepModal({ step, onClose }: { step: typeof steps[number]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md grid place-items-center p-6 animate-in fade-in">
      <div className="glass-strong rounded-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col glow-cyan">
        <header className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <div>
            <div className="text-[10px] tracking-wider uppercase text-muted-foreground">Pipeline Step {String(step.n).padStart(2, "0")}</div>
            <h2 className="text-xl font-display tracking-wide text-glow-cyan">{step.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Badge label={`${step.time} processing`} tone="neon" />
            <button className="size-9 grid place-items-center rounded-md glass"><ZoomIn className="size-4" /></button>
            <button className="size-9 grid place-items-center rounded-md glass"><ZoomOut className="size-4" /></button>
            <button className="size-9 grid place-items-center rounded-md glass"><GitCompare className="size-4" /></button>
            <button onClick={onClose} className="size-9 grid place-items-center rounded-md glass hover:text-[color:var(--critical)]"><X className="size-4" /></button>
          </div>
        </header>
        <div className="grid grid-cols-12 gap-4 p-6 overflow-y-auto">
          <div className="col-span-12 lg:col-span-7">
            <div className="relative rounded-lg overflow-hidden glass-strong aspect-square max-h-[500px] mx-auto scanline">
              <StepVisual step={step.n} />
            </div>
          </div>
          <div className="col-span-12 lg:col-span-5 space-y-3">
            <Panel title="Metrics">
              <div className="grid grid-cols-2 gap-3 text-[12px]">
                <KV k="Resolution" v="2048 × 2048" />
                <KV k="Channels" v={step.n === 2 ? "1 (gray)" : "3"} />
                <KV k="Mean Intensity" v="128.4" />
                <KV k="Std Dev" v="42.1" />
                <KV k="Edge Pixels" v="38,217" />
                <KV k="Contours" v="412" />
              </div>
            </Panel>
            <Panel title="Histogram">
              <LiveLine data={genTime(16, 60, 35)} color="var(--cyan)" height={120} />
            </Panel>
            <Panel title="AI Explanation" action={<Sparkles className="size-3.5 text-[color:var(--neon)]" />}>
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                {step.name} reduces input dimensionality and exposes the structural signal used by downstream
                overlay comparison. Current frame shows nominal noise distribution with no anomalies above 2σ.
              </p>
            </Panel>
            <button className="w-full py-2.5 rounded-md bg-primary text-primary-foreground font-display tracking-wider text-[12px] flex items-center justify-center gap-2 glow-cyan">
              <Download className="size-4" /> DOWNLOAD OUTPUT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="glass rounded p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="font-display text-primary mt-0.5">{v}</div>
    </div>
  );
}

function StepVisual({ step }: { step: number }) {
  if (step === 7) return <HeatmapBlob size={480} />;
  if (step === 8) return <div className="p-6 h-full"><FeatureMaps /></div>;
  if (step === 4 || step === 5) {
    return (
      <svg viewBox="0 0 480 480" className="w-full h-full">
        <rect width="480" height="480" fill="oklch(0.08 0.02 260)" />
        {Array.from({ length: 30 }).map((_, i) => (
          <rect key={i} x={20 + (i % 6) * 75} y={20 + Math.floor(i / 6) * 90} width={60} height={70}
            fill="none" stroke="oklch(0.95 0.05 200)" strokeWidth="1.2" opacity={0.7} />
        ))}
        {Array.from({ length: 40 }).map((_, i) => {
          const x1 = (i * 37) % 480, y1 = (i * 53) % 480;
          return <line key={i} x1={x1} y1={y1} x2={x1 + 30} y2={y1 + (i % 20)} stroke="oklch(0.82 0.17 200)" strokeWidth="0.8" opacity={0.6} />;
        })}
      </svg>
    );
  }
  return <WaferGrid size={480} defects={step >= 6} />;
}
