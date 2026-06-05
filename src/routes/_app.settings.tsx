import { createFileRoute } from "@tanstack/react-router";
import { Panel, PageHeader, Badge } from "@/components/layout/AppShell";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — SDF" }] }),
  component: Settings,
});

function Settings() {
  return (
    <>
      <PageHeader title="Settings" crumbs={["Home", "Settings"]} />
      <div className="grid grid-cols-12 gap-4">
        <Panel title="Platform" className="col-span-12 lg:col-span-6">
          <div className="space-y-3 text-[12px]">
            <Row k="Fab" v="FAB-01" />
            <Row k="Line" v="LINE-A" />
            <Row k="Default Process Node" v="7nm" />
            <Row k="Default Layer" v="Metal Layer" />
            <Row k="Inspection Mode" v="Full Analysis" />
          </div>
        </Panel>
        <Panel title="AI Model" className="col-span-12 lg:col-span-6">
          <div className="space-y-3 text-[12px]">
            <Row k="Active Model" v="CNN-Overlay v2.3.1" />
            <Row k="Inference Backend" v="ONNX · GPU" />
            <Row k="Confidence Threshold" v="0.85" />
            <Row k="Auto-Retrain" v="Weekly" />
            <Row k="Telemetry" v="Enabled" />
          </div>
        </Panel>
        <Panel title="Alerts & Thresholds" className="col-span-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
            {[
              ["Overlay Shift", "5.0 nm"],
              ["Rotation", "0.5°"],
              ["EPE", "4.0 nm"],
              ["Drift Score", "25%"],
            ].map(([k, v]) => (
              <div key={k} className="glass-strong rounded p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
                <div className="text-lg font-display text-[color:var(--cyan)] mt-1">{v}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <Badge label={v} tone="cyan" />
    </div>
  );
}
