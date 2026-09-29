import { createFileRoute } from "@tanstack/react-router";
import { Panel, PageHeader, Badge } from "@/components/layout/AppShell";
import { SupabaseStatusCard } from "@/components/SupabaseStatusCard";
import { Cpu, Database, ShieldCheck, Zap } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — SDF" }] }),
  component: Settings,
});

function Settings() {
  return (
    <>
      <PageHeader title="Platform Settings & Diagnostics" crumbs={["Home", "Settings"]} />
      <div className="grid grid-cols-12 gap-4">

        {/* Supabase Full Diagnostic & Setup Card */}
        <div className="col-span-12">
          <SupabaseStatusCard />
        </div>

        {/* AI Models Panel */}
        <Panel title="AI Models & Inference Engines" className="col-span-12 lg:col-span-6">
          <div className="space-y-4 text-[12px]">
            <div className="p-3 rounded-lg glass-strong border border-border/40 flex items-start justify-between">
              <div>
                <div className="font-display font-bold text-foreground flex items-center gap-1.5 text-sm">
                  <Cpu className="size-4 text-primary" /> YOLOv11s — Defect Detector
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Object detection model (`yolo11s.pt` / `runs/overlay_fast_model/weights/best.pt`)
                </p>
              </div>
              <Badge label="LOADED" tone="neon" pulse />
            </div>

            <div className="p-3 rounded-lg glass-strong border border-border/40 flex items-start justify-between">
              <div>
                <div className="font-display font-bold text-foreground flex items-center gap-1.5 text-sm">
                  <Zap className="size-4 text-[color:var(--neon)]" /> U-Net++ — Pixel Segmentor
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Deep segmentation model (`best_unet_model.pth` · EfficientNet-B7 / B4)
                </p>
              </div>
              <Badge label="LOADED" tone="neon" pulse />
            </div>

            <Row k="Hardware Acceleration" v="PyTorch CUDA / NVML GPU" />
            <Row k="Confidence Threshold" v="0.30 (U-Net) / 0.01 (YOLO)" />
            <Row k="8-Fold TTA Augmentation" v="Active for U-Net" />
          </div>
        </Panel>

        {/* Platform Info Panel */}
        <Panel title="Fab & Line Configuration" className="col-span-12 lg:col-span-6">
          <div className="space-y-3 text-[12px]">
            <Row k="Fab Station" v="FAB-01 (Cleanroom ISO 3)" />
            <Row k="Inspection Line" v="LINE-A (Lithography Overlay)" />
            <Row k="Supported Nodes" v="2nm, 3nm, 5nm, 7nm, 10nm" />
            <Row k="Default Layer" v="Metal Interconnect" />
            <Row k="Telemetry Stream" v="WebSocket (ws://127.0.0.1:8000/ws/live)" />
          </div>
        </Panel>

        {/* Thresholds */}
        <Panel title="Quality Control Thresholds" className="col-span-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
            {[
              ["Overlay Shift Max", "5.0 nm"],
              ["Rotational Limit", "0.5°"],
              ["Edge Placement Error", "4.0 nm"],
              ["Process Drift Max", "25%"],
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

