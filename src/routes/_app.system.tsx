import { createFileRoute } from "@tanstack/react-router";
import { Panel, PageHeader, Badge } from "@/components/layout/AppShell";
import { LiveLine, genTime } from "@/components/viz/Charts";

export const Route = createFileRoute("/_app/system")({
  head: () => ({ meta: [{ title: "System Monitoring — SDF" }] }),
  component: System,
});

function System() {
  return (
    <>
      <PageHeader title="System Monitoring" crumbs={["Home", "System Monitoring"]} />
      <div className="grid grid-cols-12 gap-4">
        <Panel title="GPU Monitoring" className="col-span-12 lg:col-span-5" action={<Badge label="NVIDIA RTX 3050" tone="neon" />}>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Stat k="Utilization" v="76%" c="var(--cyan)" />
            <Stat k="VRAM" v="3.2 / 4GB" c="var(--violet)" />
            <Stat k="Temp" v="62°C" c="var(--warning)" />
          </div>
          <LiveLine data={genTime(16, 70, 15)} color="var(--cyan)" height={160} />
        </Panel>

        <Panel title="System Status" className="col-span-12 md:col-span-6 lg:col-span-3">
          <div className="text-center py-2">
            <div className="relative inline-grid place-items-center">
              <svg viewBox="0 0 120 120" className="w-32 h-32">
                <circle cx="60" cy="60" r="50" fill="none" stroke="oklch(0.25 0.04 260)" strokeWidth="8" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--neon)" strokeWidth="8" strokeDasharray={`${2 * Math.PI * 50}`} strokeDashoffset="0" strokeLinecap="round" transform="rotate(-90 60 60)" style={{ filter: "drop-shadow(0 0 6px var(--neon))" }} />
              </svg>
              <div className="absolute text-center">
                <div className="text-2xl font-display text-[color:var(--neon)]">100%</div>
                <div className="text-[9px] tracking-wider text-muted-foreground">UPTIME</div>
              </div>
            </div>
            <div className="text-[11px] mt-2 text-muted-foreground">System Uptime · <span className="text-foreground">2d 14h 32m</span></div>
            <div className="mt-3"><Badge label="All Systems Operational" tone="neon" pulse /></div>
          </div>
        </Panel>

        <Panel title="Model Performance" className="col-span-12 md:col-span-6 lg:col-span-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat k="Model Accuracy" v="98.7%" c="var(--neon)" />
            <Stat k="Model Version" v="v2.3.1" c="var(--cyan)" />
            <Stat k="Inference Avg" v="0.82s" c="var(--violet)" />
            <Stat k="Last Updated" v="2h ago" c="var(--warning)" />
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground">CNN-Overlay · trained on 1.2M wafer samples · ONNX runtime</div>
        </Panel>

        <Panel title="Server Health Log" className="col-span-12">
          <div className="divide-y divide-border/60 -m-4 text-[11px] font-mono">
            {[
              ["11:42:18", "INFO", "Inference batch #2451 completed in 0.81s", "neon"],
              ["11:41:55", "INFO", "GPU utilization stabilized at 74%", "cyan"],
              ["11:40:02", "WARN", "Oxidation correlation drift +6.8% — review process", "warning"],
              ["11:38:11", "INFO", "Model checkpoint synced to artifact store", "neon"],
              ["11:35:46", "INFO", "Wafer image uploaded · wafer_004.png · 18.2MB", "cyan"],
              ["11:33:20", "INFO", "API server health OK · p99 = 142ms", "neon"],
            ].map(([t, lvl, msg, tone], i) => (
              <div key={i} className="px-4 py-2.5 grid grid-cols-12 gap-3">
                <span className="col-span-2 text-muted-foreground">{t}</span>
                <span className="col-span-1"><Badge label={lvl as string} tone={tone as "neon" | "cyan" | "warning"} /></span>
                <span className="col-span-9 text-foreground/90">{msg}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

function Stat({ k, v, c }: { k: string; v: string; c: string }) {
  return (
    <div className="glass-strong rounded p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="text-lg font-display mt-0.5" style={{ color: c }}>{v}</div>
    </div>
  );
}
