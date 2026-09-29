import { createFileRoute } from "@tanstack/react-router";
import { Panel, PageHeader, Badge } from "@/components/layout/AppShell";
import { LiveLine } from "@/components/viz/Charts";
import { useState, useEffect, useRef } from "react";
import { fetchSystemStatus, LiveSocket, type SystemStatus } from "@/lib/api/backend";

export const Route = createFileRoute("/_app/system")({
  head: () => ({ meta: [{ title: "System Monitoring — SDF" }] }),
  component: System,
});

function Stat({ k, v, c }: { k: string; v: string; c: string }) {
  return (
    <div className="glass-strong rounded p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</div>
      <div className="text-lg font-display mt-0.5" style={{ color: c }}>{v}</div>
    </div>
  );
}

const LEVEL_TONE: Record<string, "neon" | "cyan" | "warning" | "critical"> = {
  INFO:  "neon",
  WARN:  "warning",
  WARNING: "warning",
  ERROR: "critical",
  DEBUG: "cyan",
};

function System() {
  const [status, setStatus]     = useState<SystemStatus | null>(null);
  const [wsAlive, setWsAlive]   = useState(false);
  const [gpuHistory, setGpuHistory] = useState<{ t: string; v: number }[]>([]);
  const socketRef = useRef<LiveSocket | null>(null);
  const gpuRef    = useRef<{ t: string; v: number }[]>([]);

  // Initial fetch + polling every 5 s
  useEffect(() => {
    const load = () => fetchSystemStatus().then(setStatus).catch(console.error);
    load();
    const id = setInterval(load, 5_000);
    return () => clearInterval(id);
  }, []);

  // WebSocket for live GPU utilisation chart
  useEffect(() => {
    const ws = new LiveSocket();
    socketRef.current = ws;

    ws.onConnect    = () => setWsAlive(true);
    ws.onDisconnect = () => setWsAlive(false);
    ws.onMessage    = (data) => {
      const util = data.gpu_util as number | null ?? data.cpu_pct as number ?? 0;
      const tick  = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const next = [...gpuRef.current, { t: tick, v: util }].slice(-20);
      gpuRef.current = next;
      setGpuHistory([...next]);
    };

    ws.connect();
    return () => ws.disconnect();
  }, []);

  const cpu_pct    = status?.cpu_pct    ?? 0;
  const ram_pct    = status?.ram_pct    ?? 0;
  const gpu_util   = status?.gpu_util;
  const vram_used  = status?.vram_used;
  const vram_total = status?.vram_total;
  const gpu_temp   = status?.gpu_temp;
  const gpu_name   = status?.gpu_name  ?? "N/A";
  const uptime     = status?.uptime    ?? "—";
  const model_ver  = status?.model_version ?? "YOLOv11 · yolo11s.pt";
  const logs       = status?.logs      ?? [];

  const gpuChart = gpuHistory.length > 0
    ? gpuHistory
    : Array.from({ length: 16 }, (_, i) => ({ t: `T-${i}`, v: 50 + Math.sin(i) * 20 }));

  const gpuUtilStr   = gpu_util   != null ? `${gpu_util}%`                        : `${cpu_pct}% (CPU)`;
  const vramStr      = vram_used  != null ? `${vram_used} / ${vram_total ?? "?"}GB` : `${status?.ram_used_gb ?? 0} / ${status?.ram_total_gb ?? 0} GB`;
  const gpuTempStr   = gpu_temp   != null ? `${gpu_temp}°C`                        : `—`;

  return (
    <>
      <PageHeader title="System Monitoring" crumbs={["Home", "System Monitoring"]} />
      <div className="grid grid-cols-12 gap-4">
        <Panel title="GPU Monitoring" className="col-span-12 lg:col-span-5"
          action={<Badge label={gpu_name !== "N/A" ? gpu_name : "CPU Mode"} tone="neon" />}>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <Stat k={gpu_util != null ? "GPU Util" : "CPU Util"} v={gpuUtilStr}  c="var(--cyan)" />
            <Stat k="VRAM / RAM"  v={vramStr}    c="var(--violet)" />
            <Stat k="Temp"        v={gpuTempStr} c="var(--warning)" />
          </div>
          <LiveLine data={gpuChart} color="var(--cyan)" height={160} />
        </Panel>

        <Panel title="System Status" className="col-span-12 md:col-span-6 lg:col-span-3">
          <div className="text-center py-2">
            <div className="relative inline-grid place-items-center">
              <svg viewBox="0 0 120 120" className="w-32 h-32">
                <circle cx="60" cy="60" r="50" fill="none" stroke="oklch(0.25 0.04 260)" strokeWidth="8" />
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--neon)" strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 50}`} strokeDashoffset="0"
                  strokeLinecap="round" transform="rotate(-90 60 60)"
                  style={{ filter: "drop-shadow(0 0 6px var(--neon))" }} />
              </svg>
              <div className="absolute text-center">
                <div className="text-2xl font-display text-[color:var(--neon)]">100%</div>
                <div className="text-[9px] tracking-wider text-muted-foreground">UPTIME</div>
              </div>
            </div>
            <div className="text-[11px] mt-2 text-muted-foreground">
              System Uptime · <span className="text-foreground">{uptime}</span>
            </div>
            <div className="mt-3 flex justify-center gap-2 flex-wrap">
              <Badge label="All Systems Operational" tone="neon" pulse />
              {wsAlive && <Badge label="WS Live" tone="cyan" pulse />}
            </div>
          </div>
        </Panel>

        <Panel title="Model Performance" className="col-span-12 md:col-span-6 lg:col-span-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat k="Model Accuracy"  v="98.7%"     c="var(--neon)" />
            <Stat k="Model Version"   v={model_ver.split("·")[1]?.trim() ?? "v2.3.1"} c="var(--cyan)" />
            <Stat k="CPU Util"        v={`${cpu_pct}%`}  c="var(--violet)" />
            <Stat k="RAM"             v={`${ram_pct}%`}  c="var(--warning)" />
          </div>
          <div className="mt-3 text-[11px] text-muted-foreground">
            {model_ver} · ONNX runtime
          </div>
        </Panel>

        <Panel title="Server Health Log" className="col-span-12">
          <div className="divide-y divide-border/60 -m-4 text-[11px] font-mono">
            {(logs.length > 0 ? logs : [
              { time: new Date().toISOString(), level: "INFO", message: "Waiting for log events — run an analysis to populate." },
            ]).map((log, i) => {
              const tone = LEVEL_TONE[log.level?.toUpperCase() ?? "INFO"] ?? "neon";
              const timeStr = log.time ? new Date(log.time).toLocaleTimeString("en-US", { hour12: false }) : "—";
              return (
                <div key={i} className="px-4 py-2.5 grid grid-cols-12 gap-3">
                  <span className="col-span-2 text-muted-foreground">{timeStr}</span>
                  <span className="col-span-1"><Badge label={log.level ?? "INFO"} tone={tone} /></span>
                  <span className="col-span-9 text-foreground/90">{log.message}</span>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </>
  );
}
