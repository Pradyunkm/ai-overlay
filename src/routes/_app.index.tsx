import { createFileRoute, Link } from "@tanstack/react-router";
import { Panel, Badge } from "@/components/layout/AppShell";
import { HeatmapBlob, WaferGrid } from "@/components/viz/WaferMap";
import { LiveLine, genTime, DonutChart } from "@/components/viz/Charts";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { runAnalysis, fetchInspections } from "@/lib/api/analysis";
import {
  fetchDashboardStats,
  fetchProcessHealth,
  fetchPredictiveRisk,
  LiveSocket,
  type DashboardStats,
  type ProcessHealth,
  type PredictiveRisk
} from "@/lib/api/backend";
import {
  CheckCircle2, ExternalLink, Activity,
  TrendingUp, ShieldAlert, RotateCcw, Crosshair,
  AlertTriangle, ShieldCheck, Clock, Zap,
  UploadCloud, Camera, Play, Square,
  RefreshCcw, GitCompare,
  X, Download, ZoomIn, ZoomOut, Sparkles,
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
  { label: "Overlay Shift",           value: "0.00", unit: "nm", sub: "X: 0.00 nm  ·  Y: 0.00 nm",  tone: "neon",    icon: Crosshair },
  { label: "Rotational Misalignment", value: "0.000", unit: "°", sub: "Upload image to analyse",      tone: "neon",    icon: RotateCcw },
  { label: "Edge Placement Error",    value: "0.00", unit: "nm", sub: "Upload image to analyse",      tone: "neon",    icon: AlertTriangle },
  { label: "Alignment Confidence",    value: "0.0",  unit: "%",  sub: "Upload image to analyse",      tone: "neon",    icon: ShieldCheck },
  { label: "Defect Severity",         value: "None", unit: "",   sub: "Score: 0.0 / 10",              tone: "neon",    icon: Zap },
  { label: "AI Inference Time",       value: "0.00", unit: "s",  sub: "Awaiting analysis",             tone: "neon",    icon: Clock },
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



const chartGrid  = "oklch(0.50 0.06 240 / 0.15)";
const chartAxis  = "oklch(0.70 0.03 240 / 0.5)";
const tipStyle   = {
  background: "oklch(0.18 0.04 260 / 0.95)",
  border: "1px solid oklch(0.78 0.18 200 / 0.3)",
  borderRadius: 6, fontSize: 11, color: "white",
};

import type { Defect, AnalysisResult } from "@/lib/api/analysis";

/* ══════════════════════════════════════════════ */
/* ══════════════════════════════════════════════ */
const pipelineSteps = [
  { n: 1, name: "Input Image",            desc: "Original wafer scan",                      time: "0.00s" },
  { n: 2, name: "Grayscale",              desc: "RGB → single-channel intensity map",         time: "0.04s" },
  { n: 3, name: "Noise Reduction",        desc: "Gaussian blur σ=1.4 to suppress noise",      time: "0.06s" },
  { n: 4, name: "Edge Detection",         desc: "Multi-stage Canny (low=80, high=180)",       time: "0.11s" },
  { n: 5, name: "Contour Extraction",     desc: "Die boundaries and structural contours",     time: "0.09s" },
  { n: 6, name: "Overlay Comparison",     desc: "Pixel-aligned diff — colourised deviation",  time: "0.18s" },
  { n: 7, name: "Heatmap Generation",     desc: "Density heatmap — accumulated deviations",  time: "0.13s" },
  { n: 8, name: "CNN / YOLO Output",      desc: "YOLO defect detections with bounding boxes", time: "0.31s" },
];

export default function Dashboard() {
  const [uploadMode, setUploadMode] = useState<"upload" | "webcam" | "compare">("upload");
  const [uploadReady, setUploadReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Supabase & Analysis state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [latestAnalysis, setLatestAnalysis] = useState<AnalysisResult | null>(null);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);

  // Pipeline Viewer state
  const [activeStep, setActiveStep] = useState<number>(1);
  const [stepModalOpen, setStepModalOpen] = useState(false);

  // Upload bar dropdown selections
  const [selectedNode, setSelectedNode] = useState(nodes[3]); // 7nm (DUV)
  const [selectedLayer, setSelectedLayer] = useState(layers[0]); // Metal Interconnect
  const [selectedModel, setSelectedModel] = useState(models[0]); // YOLO (Fast)

  // Live backend stats and WebSocket integration
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [process, setProcess] = useState<ProcessHealth | null>(null);
  const [predictive, setPredictive] = useState<PredictiveRisk | null>(null);
  const [liveDefects, setLiveDefects] = useState<number | null>(null);
  const [defectHistory, setDefectHistory] = useState<{ t: string; v: number }[]>([]);
  const defectHistRef = useRef<{ t: string; v: number }[]>([]);

  const loadStats = () => {
    fetchDashboardStats().then(setStats).catch(console.error);
    fetchProcessHealth().then(setProcess).catch(console.error);
    fetchPredictiveRisk().then(setPredictive).catch(console.error);
  };

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const ws = new LiveSocket();
    ws.onMessage = (data) => {
      if (data.live_defect_count != null) {
        const count = data.live_defect_count as number;
        setLiveDefects(count);
        const tick = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const next = [...defectHistRef.current, { t: tick, v: count }].slice(-20);
        defectHistRef.current = next;
        setDefectHistory([...next]);
      }
    };
    ws.connect();
    return () => ws.disconnect();
  }, []);

  const handleStartAnalysis = async () => {
    if (!selectedFile) {
      toast.error("Please upload or drag a wafer scan first.");
      return;
    }

    setAnalyzing(true);
    setSelectedDefect(null);
    const toastId = toast.loading("Sending wafer scan to AI backend...");

    try {
      const analysisResult = await runAnalysis({
        file:         selectedFile,
        process_node: selectedNode,
        layer_type:   selectedLayer,
        model_type:   selectedModel.id,
        onStatus: (msg) => toast.loading(msg, { id: toastId }),
      });

      setLatestAnalysis(analysisResult);
      loadStats();

      if (analysisResult.saved_to_supabase) {
        toast.success("AI Analysis complete — saved to Supabase!", { id: toastId });
      } else if (!supabase) {
        toast.success("AI Analysis complete! (Local preview — Supabase not configured)", { id: toastId });
      } else {
        toast.success("AI Analysis complete!", { id: toastId });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(`Analysis failed: ${err.message || err}`, { id: toastId });
    } finally {
      setAnalyzing(false);
    }
  };

  // Dynamic overrides of KPIs based on real backend metrics
  const activeData = latestAnalysis || (stats?.latest_metrics ? {
    metrics: stats.latest_metrics,
    inference_time: stats.avg_inference_time ?? 0.82,
    defects_count: stats.latest_metrics.defects_count ?? 0,
    filename: stats.latest_metrics.filename ?? "last_wafer_scan.png",
  } : null);

  const m = activeData?.metrics ?? {};
  const activeKpis = kpis.map((k) => {
    // Before any analysis, keep all values at 0
    if (!latestAnalysis && !stats?.latest_metrics) return k;
    const dc = activeData?.defects_count ?? 0;
    if (k.label === "AI Inference Time") {
      const v = activeData?.inference_time ?? 0;
      return { ...k, value: v.toFixed(2), sub: "Actual YOLOv11", unit: "s", tone: "neon" };
    }
    if (k.label === "Defect Severity") {
      const sev = m.defect_severity ?? (dc === 0 ? "None" : dc <= 2 ? "Low" : dc <= 4 ? "Medium" : dc <= 6 ? "High" : "Critical");
      const tone = sev === "None" ? "neon" : sev === "Low" ? "cyan" : sev === "Medium" ? "warning" : "critical";
      return { ...k, value: sev, sub: `Score: ${m.severity_score?.toFixed(1) ?? (dc * 1.4).toFixed(1)} / 10`, tone };
    }
    if (k.label === "Overlay Shift") {
      const v = m.overlay_shift ?? (dc > 0 ? 3.42 + dc * 0.15 : 0.0);
      return { ...k, value: v.toFixed(2), sub: `X: ${(m.overlay_x ?? 0).toFixed(2)} · Y: ${(m.overlay_y ?? 0).toFixed(2)} nm`, unit: "nm", tone: v > 5 ? "critical" : v > 2 ? "warning" : "neon" };
    }
    if (k.label === "Rotational Misalignment") {
      const v = m.rotation_misalignment ?? 0;
      return { ...k, value: v.toFixed(3), sub: v < 0.5 ? "Within tolerance" : "Exceeds threshold", unit: "°", tone: v > 0.5 ? "warning" : "neon" };
    }
    if (k.label === "Edge Placement Error") {
      const v = m.edge_placement_error ?? 0;
      return { ...k, value: v.toFixed(2), sub: v < 4 ? "High Confidence" : "Review Required", unit: "nm", tone: v > 4 ? "critical" : v > 2.5 ? "warning" : "neon" };
    }
    if (k.label === "Alignment Confidence") {
      const v = m.alignment_confidence ?? 0;
      return { ...k, value: v.toFixed(1), sub: v > 90 ? "High Confidence" : v > 0 ? "Low Confidence" : "Upload image to analyse", unit: "%", tone: v > 90 ? "neon" : v > 75 ? "warning" : v > 0 ? "critical" : "neon" };
    }
    return k;
  });

  // Helper: trigger download from a URL
  const downloadImage = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-4">
      {/* ══ DASHBOARD HEADER & PIPELINE LINK ══ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-display">
            Inspection Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5 font-mono">
            Real-time overlay telemetry & defect analysis
          </p>
        </div>
        <Link
          to="/steps"
          className="flex items-center gap-1.5 self-start sm:self-auto px-3.5 py-1.5 rounded-lg border border-primary/40 text-primary text-xs font-mono font-medium hover:glow-cyan transition bg-white/[0.01]"
        >
          <GitCompare className="size-3.5" />
          Pipeline Steps
        </Link>
      </div>

      {/* ══ QUICK UPLOAD BAR ══ */}
        <QuickUploadBar
          mode={uploadMode}
          setMode={setUploadMode}
          ready={uploadReady}
          setReady={setUploadReady}
          dragging={dragging}
          setDragging={setDragging}
          fileRef={fileRef}
          selectedFile={selectedFile}
          setSelectedFile={setSelectedFile}
          onStartAnalysis={handleStartAnalysis}
          loading={analyzing}
          selectedNode={selectedNode}
          setSelectedNode={setSelectedNode}
          selectedLayer={selectedLayer}
          setSelectedLayer={setSelectedLayer}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          onWebcamResult={(data) => {
            setLatestAnalysis({
              filename: data.filename ?? "webcam_capture.jpg",
              original_image: data.original_image ?? "",
              annotated_image: data.annotated_image ?? "",
              defects_count: data.defects_count ?? 0,
              defects: data.defects ?? [],
              inference_time: data.inference_time ?? 0,
              process_node: selectedNode,
              layer_type: selectedLayer,
              step_images: data.step_images ?? {},
              metrics: data.metrics ?? {},
              saved_to_supabase: false,
            });
          }}
          onCompareResult={(data) => {
            setLatestAnalysis({
              filename: "comparison_result.jpg",
              original_image: data.reference?.annotated_image ?? "",
              annotated_image: data.test?.annotated_image ?? "",
              defects_count: (data.reference?.defects_count ?? 0) + (data.test?.defects_count ?? 0),
              defects: [...(data.reference?.defects ?? []), ...(data.test?.defects ?? [])],
              inference_time: (data.reference?.inference_time ?? 0) + (data.test?.inference_time ?? 0),
              process_node: selectedNode,
              layer_type: selectedLayer,
              step_images: data.diff_image ? { "6": data.diff_image } : {},
              metrics: {},
              saved_to_supabase: false,
            });
          }}
        />

        {/* ══ LATEST SCAN ANALYSIS RESULTS ══ */}
        {latestAnalysis && (
          <Panel
            title="Latest Wafer AI Inspection Results"
            subtitle={`${latestAnalysis.filename} · Node: ${latestAnalysis.process_node} · Layer: ${latestAnalysis.layer_type}`}
            action={
              <div className="flex gap-2 items-center">
                <Link
                  to="/steps"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-primary/45 text-primary text-[10px] uppercase font-mono tracking-wider hover:glow-cyan transition"
                >
                  <GitCompare className="size-3" />
                  Steps
                </Link>
                <Badge label={`MODEL: ${(latestAnalysis.model_type || selectedModel.id).toUpperCase()}`} tone="neon" />
                {latestAnalysis.saved_to_supabase ? (
                  <Badge label="SUPABASE SAVED" tone="neon" pulse />
                ) : (
                  <Badge label="LOCAL PREVIEW" tone="warning" />
                )}
                <Badge label={`DEFECTS: ${latestAnalysis.defects_count}`} tone={latestAnalysis.defects_count > 0 ? "critical" : "neon"} />
              </div>
            }
          >
            <div className="grid grid-cols-12 gap-5">
              {/* Wafer Image side-by-side or comparison */}
              <div className="col-span-12 xl:col-span-8 flex flex-col md:flex-row gap-4">
                {/* Original Image */}
                <div className="flex-1 flex flex-col gap-2">
                  <div className="text-[10px] tracking-wider uppercase font-semibold text-muted-foreground font-mono">Original Scan</div>
                  <div className="relative aspect-square md:aspect-[4/3] rounded-lg overflow-hidden glass-strong border border-border/60 flex items-center justify-center bg-black/40">
                    <img
                      src={latestAnalysis.original_image}
                      alt="Original Wafer Scan"
                      className="max-h-[300px] max-w-full object-contain"
                    />
                  </div>
                </div>

                {/* Annotated Image */}
                <div className="flex-1 flex flex-col gap-2">
                  <div className="text-[10px] tracking-wider uppercase font-semibold text-primary font-mono">AI Annotated Defects Map</div>
                  <div className="relative aspect-square md:aspect-[4/3] rounded-lg overflow-hidden glass-strong border border-border/60 flex items-center justify-center bg-black/40 scanline">
                    <img
                      src={latestAnalysis.annotated_image}
                      alt="Annotated Wafer Scan"
                      className="max-h-[300px] max-w-full object-contain"
                    />
                  </div>
                </div>
              </div>

              {/* Detections List & Details */}
              <div className="col-span-12 xl:col-span-4 flex flex-col h-full justify-between">
                <div className="flex flex-col gap-3 h-full">
                  <div className="text-[10px] tracking-wider uppercase font-semibold text-muted-foreground font-mono">Scan Summary</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="glass-strong rounded-lg p-3 border border-border/30">
                      <div className="text-[9px] text-muted-foreground uppercase font-mono">Detections Count</div>
                      <div className="text-xl font-bold mt-1 text-foreground font-display">{latestAnalysis.defects_count}</div>
                    </div>
                    <div className="glass-strong rounded-lg p-3 border border-border/30">
                      <div className="text-[9px] text-muted-foreground uppercase font-mono">Inference Time</div>
                      <div className="text-xl font-bold mt-1 text-foreground font-display">{latestAnalysis.inference_time.toFixed(3)}s</div>
                    </div>
                  </div>

                  {/* Defects list */}
                  <div className="flex-1 flex flex-col min-h-[160px] max-h-[200px] mt-2 border border-border/40 rounded-lg overflow-hidden bg-black/15">
                    <div className="bg-white/[0.02] border-b border-border/40 px-3.5 py-2 grid grid-cols-12 gap-1 col-label-text text-muted-foreground text-[8.5px]">
                      <span className="col-span-3 text-center">Defect</span>
                      <span className="col-span-5">Class Label</span>
                      <span className="col-span-4 text-right">Confidence</span>
                    </div>
                    <div className="overflow-y-auto divide-y divide-border/20 flex-1">
                      {latestAnalysis.defects.length > 0 ? (
                        latestAnalysis.defects.map((d, i) => (
                          <div
                            key={i}
                            onClick={() => setSelectedDefect(selectedDefect === d ? null : d)}
                            className={`px-3.5 py-2 grid grid-cols-12 gap-1 items-center row-desc-text hover:bg-white/[0.03] cursor-pointer transition-colors ${
                              selectedDefect === d ? "bg-primary/10 border-l border-l-primary" : ""
                            }`}
                          >
                            <span className="col-span-3 flex justify-center">
                              {d.crop_image ? (
                                <img
                                  src={d.crop_image}
                                  alt={`Defect ${i + 1}`}
                                  className="w-7 h-7 rounded object-cover border border-border/60 bg-black/40 hover:scale-110 transition-transform"
                                />
                              ) : (
                                <span className="font-mono text-[10px] text-primary">{i + 1}</span>
                              )}
                            </span>
                            <span className="col-span-5 font-semibold text-foreground truncate">{d.label || `Class ${d.class_id}`}</span>
                            <span className="col-span-4 text-right font-mono text-[11px] text-[color:var(--neon)]">
                              {(d.confidence * 100).toFixed(1)}%
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex-1 h-full flex flex-col items-center justify-center p-4 text-center">
                          <CheckCircle2 className="size-6 text-[color:var(--neon)] mb-1" />
                          <span className="text-[11px] text-muted-foreground">No overlay defects identified</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Defect Spotlight Zoom */}
                  {selectedDefect && (
                    <div className="mt-3 p-3 rounded-lg border border-primary/30 bg-primary/5 animate-fade-in flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-semibold text-primary font-mono">Defect Spotlight Zoom</span>
                        <button
                          onClick={() => setSelectedDefect(null)}
                          className="text-[9px] hover:text-foreground text-muted-foreground font-mono"
                        >
                          Clear
                        </button>
                      </div>
                      <div className="flex gap-3 items-center">
                        <div className="relative size-14 shrink-0 rounded overflow-hidden border border-border/80 bg-black/60 flex items-center justify-center scanline">
                          {selectedDefect.crop_image ? (
                            <img
                              src={selectedDefect.crop_image}
                              alt="Defect Zoom"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-muted-foreground text-xs font-mono">?</span>
                          )}
                        </div>
                        <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                          <div className="text-xs font-bold text-foreground capitalize truncate">
                            {selectedDefect.label || "Defect Spot"}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            Confidence: <span className="text-[color:var(--neon)] font-semibold">{(selectedDefect.confidence * 100).toFixed(2)}%</span>
                          </div>
                          <div className="text-[9px] text-muted-foreground/80 font-mono truncate">
                            Coords: [{selectedDefect.box.join(", ")}]
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Panel>
        )}

        {/* ══ ANALYSIS STATUS BANNER ══ */}
        {latestAnalysis && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[color:var(--neon)]/40 bg-[color:var(--neon)]/5 animate-fade-in">
            <CheckCircle2 className="size-4 shrink-0" style={{ color: "var(--neon)" }} />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-semibold" style={{ color: "var(--neon)" }}>Analysis Complete</span>
              <span className="text-[11px] text-muted-foreground ml-2 font-mono">{latestAnalysis.filename} · {latestAnalysis.defects_count} defect{latestAnalysis.defects_count !== 1 ? "s" : ""} detected · {latestAnalysis.inference_time.toFixed(3)}s</span>
            </div>
            <span className="text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: "var(--neon)", color: "oklch(0.12 0.03 260)" }}>ANALYSED</span>
          </div>
        )}

        {/* ══ KPI STRIP ══ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          {activeKpis.map((k) => {
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {/* Overlay Error Heatmap */}
          <section className="glass rounded-xl overflow-hidden">
            <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
              <h3 className="section-title">Overlay Error Heatmap</h3>
              <div className="flex items-center gap-2">
                <Link
                  to="/steps"
                  className="flex items-center gap-1 px-2 py-0.5 rounded border border-primary/30 text-primary text-[9px] uppercase font-mono tracking-wider transition-all hover:bg-primary/10"
                >
                  View Steps →
                </Link>
                {activeData ? <Badge label="1 TVF" tone="neon" pulse /> : <Badge label="Live" tone="neon" pulse />}
              </div>
            </header>
            <div className="p-4 flex items-center gap-4">
              <div className="flex-1 aspect-square max-w-[160px] rounded-lg overflow-hidden flex items-center justify-center bg-black/20">
                {(activeData as any)?.step_images?.["7"] ? (
                  <img src={(activeData as any).step_images["7"]} alt="Overlay heatmap" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <HeatmapBlob size={160} />
                )}
              </div>
              <ColorBar labels={["High Error", "Low Error"]} />
            </div>
          </section>

          {/* Defect Density Map */}
          <section className="glass rounded-xl overflow-hidden">
            <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
              <h3 className="section-title">Defect Density Map</h3>
              <div className="flex items-center gap-2">
                {latestAnalysis?.density_map
                  ? <Badge label={`${latestAnalysis.defects_count} Detections`} tone="cyan" pulse />
                  : <Badge label="Live" tone="cyan" pulse />}
              </div>
            </header>
            <div className="p-4 flex items-center gap-3">
              {/* Map image */}
              <div
                className="flex-1 aspect-square max-w-[160px] rounded-lg overflow-hidden flex items-center justify-center bg-black/20 cursor-zoom-in relative group"
                onClick={() => {
                  const url = latestAnalysis?.density_map;
                  if (url) window.open(url, "_blank", "noopener");
                }}
              >
                {latestAnalysis?.density_map ? (
                  <>
                    <img
                      src={latestAnalysis.density_map}
                      alt="Defect density map"
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition bg-black/40 rounded-lg">
                      <ZoomIn className="size-5 text-white" />
                    </div>
                  </>
                ) : (
                  <HeatmapBlob size={160} />
                )}
              </div>
              {/* Colour legend + stats */}
              <div className="flex flex-col justify-between h-[160px] gap-2">
                {/* Gradient bar */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[9px] font-mono text-[color:var(--critical)]">HIGH</span>
                  <div
                    className="w-3 flex-1 rounded"
                    style={{
                      background: "linear-gradient(to bottom, #ff0000, #ff6600, #ffcc00, #00ccff, #000066)",
                      minHeight: 80,
                    }}
                  />
                  <span className="text-[9px] font-mono text-muted-foreground">LOW</span>
                </div>
                {/* Mini stats */}
                <div className="space-y-1">
                  <div className="text-[9px] text-muted-foreground font-mono">Defects</div>
                  <div className="text-sm font-bold" style={{ color: "var(--cyan)" }}>
                    {latestAnalysis?.defects_count ?? stats?.total_defects ?? "—"}
                  </div>
                  <div className="text-[9px] text-muted-foreground font-mono">Edge Density</div>
                  <div className="text-xs font-mono" style={{ color: "var(--neon)" }}>
                    {latestAnalysis?.metrics.edge_density_pct
                      ? `${latestAnalysis.metrics.edge_density_pct.toFixed(1)}%`
                      : "—"}
                  </div>
                </div>
              </div>
            </div>
            {/* If no analysis run yet, show a hint */}
            {!latestAnalysis?.density_map && (
              <div className="px-4 pb-3 text-[9px] text-muted-foreground font-mono border-t border-border/30 pt-2">
                Run an analysis to generate a real density map ↑
              </div>
            )}
          </section>

          {/* Wafer Yield Prediction */}
          <section className="glass rounded-xl">
            <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
              <h3 className="section-title">Wafer Yield Prediction</h3>
              {(() => {
                if (!latestAnalysis && !stats?.yield_pct) return <Badge label="Upload to predict" tone="neon" />;
                const yld = latestAnalysis?.wafer_yield ?? process?.wafer_yield ?? stats?.yield_pct ?? 0;
                const prev = process?.wafer_yield ?? stats?.yield_pct ?? 0;
                const delta = latestAnalysis?.wafer_yield ? +(latestAnalysis.wafer_yield - prev).toFixed(1) : null;
                const tone = yld >= 95 ? "neon" : yld >= 85 ? "warning" : "critical";
                return (
                  <Badge
                    label={delta !== null ? `${delta >= 0 ? "+" : ""}${delta}% vs baseline` : `${yld.toFixed(1)}% yield`}
                    tone={tone}
                  />
                );
              })()}
            </header>
            <div className="p-3 pb-4">
              {/* Donut + stats row */}
              <div className="flex items-center gap-4 mb-3">
                {(() => {
                  const yld = latestAnalysis?.wafer_yield ?? process?.wafer_yield ?? stats?.yield_pct ?? 0;
                  const hasData = !!(latestAnalysis || stats?.yield_pct);
                  const tone = !hasData ? "var(--neon)" : yld >= 95 ? "var(--neon)" : yld >= 85 ? "var(--warning)" : "var(--critical)";
                  const totalDie = 9445;
                  const goodDie = hasData ? Math.round(yld / 100 * totalDie) : 0;
                  return (
                    <>
                      <div className="relative w-[80px] h-[80px] shrink-0">
                        <DonutChart data={[
                          { name: "Good Die", value: hasData ? yld : 0, color: tone },
                          { name: "Empty", value: hasData ? 100 - yld : 100, color: "oklch(0.28 0.06 260)" },
                        ]} />
                        <div className="absolute inset-0 grid place-items-center pointer-events-none">
                          <div className="text-sm font-bold" style={{ color: tone, fontFamily: "Inter, sans-serif" }}>
                            {hasData ? `${yld.toFixed(1)}%` : "—"}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <div>
                          <div className="sub-text text-muted-foreground">Good Die</div>
                          <div className="row-name-text" style={{ color: tone }}>{hasData ? goodDie.toLocaleString() : "0"}</div>
                        </div>
                        <div>
                          <div className="sub-text text-muted-foreground">Total Die</div>
                          <div className="row-name-text">{totalDie.toLocaleString()}</div>
                        </div>
                        {latestAnalysis?.wafer_yield && (
                          <div className="text-[9px] font-mono text-muted-foreground">
                            Scan: {latestAnalysis.wafer_yield.toFixed(1)}%
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
              {/* Trend chart — full width */}
              <div style={{ width: "100%", height: 95, marginLeft: -4, marginRight: -4 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={process?.yield_trend && process.yield_trend.length > 0
                      ? process.yield_trend
                      : (latestAnalysis ? yieldTrend : yieldTrend.map(d => ({ ...d, v: 0 })))}
                    margin={{ left: 2, right: 8, top: 6, bottom: 2 }}
                  >
                    <defs>
                      <linearGradient id="yieldGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--neon)" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="var(--neon)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={chartGrid} vertical={false} />
                    <XAxis dataKey="t" stroke={chartAxis} tick={{ fontSize: 8 }} tickLine={false} interval={4} />
                    <YAxis
                      stroke={chartAxis}
                      tick={{ fontSize: 8 }}
                      tickLine={false}
                      axisLine={false}
                      domain={latestAnalysis ? [80, 100] : [0, 100]}
                      width={28}
                    />
                    <Tooltip contentStyle={tipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`, "Yield"]} />
                    <Area
                      dataKey="v"
                      stroke="var(--neon)"
                      strokeWidth={2}
                      fill="url(#yieldGrad)"
                      type="monotone"
                      isAnimationActive={false}
                      dot={(props: any) => {
                        const isForecast = (props.payload?.t as string)?.startsWith("F-");
                        if (!isForecast) return <g key={props.key} />;
                        return <circle key={props.key} cx={props.cx} cy={props.cy} r={3} fill="none" stroke="var(--neon)" strokeWidth={1.5} strokeDasharray="2 1" />;
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              {process?.yield_trend && process.yield_trend.some(p => (p.t as string).startsWith("F-")) && (
                <div className="text-[9px] font-mono text-muted-foreground mt-1 flex items-center gap-1">
                  <span style={{ color: "var(--neon)" }}>◦◦◦</span> Holt forecast (5 runs)
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ══ BOTTOM ROW ══ */}
        <div className="grid grid-cols-12 gap-3">

          {/* Real-Time Defect Counter */}
          <section className="col-span-12 lg:col-span-3 glass rounded-xl">
            <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
              <h3 className="section-title">Real-Time Defect Counter</h3>
              <Badge label="Live" tone="neon" pulse />
            </header>
            <div className="p-4 pb-5">
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-5xl font-bold" style={{ color: "var(--cyan)", fontFamily: "Inter, sans-serif" }}>
                  {liveDefects ?? stats?.total_defects ?? 0}
                </span>
                <span className="sub-text text-muted-foreground">defects / min</span>
              </div>
              <div style={{ height: 100 }}>
                <LiveLine data={defectHistory.length > 0 ? defectHistory : genTime(12, 130, 50)} color="var(--cyan)" height={100} />
              </div>
            </div>
          </section>

          {/* Process Drift Analysis */}
          <section className="col-span-12 lg:col-span-3 glass rounded-xl">
            <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
              <h3 className="section-title">Process Drift Analysis</h3>
            </header>
            <div className="p-4 pb-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="size-3.5" style={{ color: "var(--warning)" }} />
                <span className="row-desc-text" style={{ color: "var(--warning)" }}>Drift Score: <strong>{(process?.drift_score ?? 18.6).toFixed(1)}%</strong></span>
                <span className="sub-text text-muted-foreground">· {process?.drift_score && process.drift_score > 35 ? "High Risk" : "Medium Risk"}</span>
              </div>
              <div style={{ height: 100 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={process?.drift_trend && process.drift_trend.length > 0 ? process.drift_trend : driftData} margin={{ left: -10, right: 8, top: 4, bottom: 2 }}>
                    <CartesianGrid stroke={chartGrid} vertical={false} />
                    <XAxis dataKey="t" stroke={chartAxis} tick={{ fontSize: 9 }} tickLine={false} interval={2} />
                    <YAxis stroke={chartAxis} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} width={24} />
                    <Tooltip contentStyle={tipStyle} />
                    <Line dataKey="v" stroke="var(--warning)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* Oxidation Process Correlation */}
          <section className="col-span-12 lg:col-span-3 glass rounded-xl">
            <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
              <h3 className="section-title">Oxidation Process Correlation</h3>
            </header>
            <div className="p-4 pb-5">
              <div className="flex gap-4 mb-3">
                <MiniKV label="Temp Variation" value={`+${(process?.temp_variation ?? 2.4).toFixed(1)}°C`} color="var(--warning)" />
                <MiniKV label="Oxidation Inconsistency" value={`${(process?.oxidation_delta ?? 6.8).toFixed(1)}%`} color="var(--cyan)" />
              </div>
              <div style={{ height: 100 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ left: -10, right: 8, top: 4, bottom: 16 }}>
                    <CartesianGrid stroke={chartGrid} />
                    <XAxis type="number" dataKey="x" stroke={chartAxis} tick={{ fontSize: 9 }}
                      label={{ value: "Temperature (°C)", position: "insideBottom", offset: -10, fill: chartAxis, fontSize: 9 }} />
                    <YAxis type="number" dataKey="y" stroke={chartAxis} tick={{ fontSize: 9 }} width={24} />
                    <Tooltip contentStyle={tipStyle} />
                    <Scatter data={oxData}>
                      {oxData.map((d, i) => (
                        <Cell key={i} fill={["var(--cyan)", "var(--warning)", "var(--neon)"][d.g]} opacity={0.75} />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* Predictive Failure Risk */}
          <section className="col-span-12 lg:col-span-3 glass rounded-xl">
            <header className="flex items-center justify-between px-4 py-2.5 border-b border-border/60">
              <h3 className="section-title">Predictive Failure Risk</h3>
              {(() => {
                if (!latestAnalysis && !predictive?.risk_pct) return <Badge label="Upload to analyse" tone="neon" />;
                const risk = latestAnalysis?.failure_risk ?? predictive?.risk_pct ?? 0;
                const tone = risk < 15 ? "neon" : risk < 35 ? "warning" : "critical";
                const label = latestAnalysis?.risk_label ?? predictive?.risk_label ?? (risk < 15 ? "Low Risk" : risk < 35 ? "Med Risk" : "High Risk");
                return <Badge label={label} tone={tone} pulse={risk >= 35} />;
              })()}
            </header>
            <div className="p-3 pb-4">
              {/* Donut + label row */}
              {(() => {
                const hasData = !!(latestAnalysis || predictive?.risk_pct);
                const risk      = hasData ? (latestAnalysis?.failure_risk ?? predictive?.risk_pct ?? 0) : 0;
                const label     = hasData
                  ? (latestAnalysis?.risk_label ?? predictive?.risk_label ?? (risk < 15 ? "Low Risk" : risk < 35 ? "Medium Risk" : "High Risk"))
                  : "No Data";
                const forecast  = predictive?.forecast_24h ?? null;
                const riskColor = !hasData ? "var(--neon)" : risk < 15 ? "var(--neon)" : risk < 35 ? "var(--warning)" : "var(--critical)";
                return (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="relative w-[80px] h-[80px] shrink-0">
                        <DonutChart data={[
                          { name: "Risk", value: hasData ? risk : 0,        color: riskColor },
                          { name: "Safe", value: hasData ? 100 - risk : 100, color: "oklch(0.28 0.06 260)" },
                        ]} />
                        <div className="absolute inset-0 grid place-items-center pointer-events-none">
                          <div className="text-center">
                            <div className="text-base font-bold" style={{ color: riskColor, fontFamily: "Inter, sans-serif" }}>
                              {hasData ? `${risk.toFixed(1)}%` : "0%"}
                            </div>
                            <div className="text-[8px] text-muted-foreground font-mono leading-tight">
                              {hasData ? label.replace(" Risk", "") : "—"}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col gap-2">
                        <div className="flex items-center gap-1">
                          <ShieldAlert className="size-3.5" style={{ color: riskColor }} />
                          <span className="row-desc-text font-semibold" style={{ color: riskColor }}>{label}</span>
                        </div>
                        {/* Breakdown stats */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[9px]">
                            <span className="text-muted-foreground font-mono">Defects</span>
                            <span className="font-mono" style={{ color: riskColor }}>
                              {latestAnalysis?.defects_count ?? "0"}
                            </span>
                          </div>
                          <div className="flex justify-between text-[9px]">
                            <span className="text-muted-foreground font-mono">Overlay Shift</span>
                            <span className="font-mono text-foreground">
                              {latestAnalysis?.metrics?.overlay_shift != null
                                ? `${latestAnalysis.metrics.overlay_shift.toFixed(2)} nm`
                                : "0.00 nm"}
                            </span>
                          </div>
                          {forecast != null && (
                            <div className="flex justify-between text-[9px]">
                              <span className="text-muted-foreground font-mono">24h Forecast</span>
                              <span className="font-mono" style={{ color: forecast > risk ? "var(--critical)" : "var(--neon)" }}>
                                {forecast.toFixed(1)}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Risk trend chart — full container */}
                    <div style={{ width: "100%", height: 85, marginLeft: -4, marginRight: -4 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={predictive?.trend && predictive.trend.length > 0
                            ? predictive.trend
                            : (hasData ? riskData : riskData.map(d => ({ ...d, v: 0 })))}
                          margin={{ left: 2, right: 8, top: 4, bottom: 2 }}
                        >
                          <defs>
                            <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={riskColor} stopOpacity={0.35} />
                              <stop offset="100%" stopColor={riskColor} stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke={chartGrid} vertical={false} />
                          <XAxis dataKey="t" stroke={chartAxis} tick={{ fontSize: 8 }} tickLine={false} interval={3} />
                          <YAxis stroke={chartAxis} tick={{ fontSize: 8 }} tickLine={false} axisLine={false} domain={[0, 'auto']} width={24} />
                          <Tooltip contentStyle={tipStyle} formatter={(v: number) => [`${v.toFixed(1)}%`, "Risk"]} />
                          <Area dataKey="v" stroke={riskColor} strokeWidth={2} fill="url(#riskGrad)" type="monotone" isAnimationActive={false} dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    {predictive?.trend && predictive.trend.some((p: any) => (p.t as string).startsWith("F-")) && (
                      <div className="text-[9px] font-mono text-muted-foreground mt-1 flex items-center gap-1">
                        <span style={{ color: riskColor }}>◦◦◦</span> Holt forecast (5 runs)
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </section>
        </div>

        {/* ══ STEP-BY-STEP PIPELINE VIEWER ══ */}
        <section className="glass rounded-xl overflow-hidden">
          <header className="flex items-center justify-between px-5 py-3 border-b border-border/60">
            <div>
              <h3 className="section-title flex items-center gap-2">
                <GitCompare className="size-4 text-primary" />
                Step-by-Step Pipeline
              </h3>
              <p className="sub-text text-muted-foreground mt-0.5">
                {latestAnalysis ? `Processing steps for ${latestAnalysis.filename}` : "8-stage AI processing pipeline"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {latestAnalysis && <Badge label="REAL DATA" tone="neon" pulse />}
              {!latestAnalysis && <Badge label="DEMO" tone="warning" />}
              {stepModalOpen && (
                <button
                  onClick={() => setStepModalOpen(false)}
                  className="size-7 rounded-md glass grid place-items-center text-muted-foreground hover:text-primary transition"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </header>

          <div className="p-4 flex flex-col gap-4">
            {/* Step Tab Pills */}
            <div className="flex flex-wrap gap-2">
              {pipelineSteps.map((s) => {
                const imgUrl = (latestAnalysis as any)?.step_images?.[String(s.n)] ?? "";
                const hasImg = Boolean(imgUrl);
                const isActive = activeStep === s.n;
                return (
                  <button
                    key={s.n}
                    onClick={() => { setActiveStep(s.n); setStepModalOpen(true); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-mono transition-all ${
                      isActive
                        ? "bg-primary/10 border-primary/40 text-primary glow-cyan"
                        : "glass border-border/40 text-muted-foreground hover:text-foreground hover:border-primary/30"
                    }`}
                  >
                    <span
                      className={`size-5 rounded flex items-center justify-center text-[9px] font-bold shrink-0 ${
                        hasImg ? "bg-[color:var(--neon)]/20 text-[color:var(--neon)] border border-[color:var(--neon)]/40"
                               : "bg-white/5 text-muted-foreground border border-border/30"
                      }`}
                    >
                      {String(s.n).padStart(2, "0")}
                    </span>
                    <span className="hidden sm:block">{s.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Step Preview */}
            {(() => {
              const step = pipelineSteps.find(s => s.n === activeStep)!;
              const imgUrl = (latestAnalysis as any)?.step_images?.[String(activeStep)] ?? "";
              return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Image Preview */}
                  <div className="lg:col-span-2">
                    <div className="relative rounded-xl overflow-hidden glass-strong border border-border/50 bg-black/40 flex items-center justify-center" style={{ minHeight: 260 }}>
                      {imgUrl ? (
                        <img
                          src={imgUrl}
                          alt={`Step ${activeStep}: ${step.name}`}
                          className="max-w-full max-h-[300px] object-contain transition-all"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-3 py-10 text-center">
                          <div className="size-12 rounded-xl glass border border-border/40 grid place-items-center">
                            <GitCompare className="size-6 text-muted-foreground/50" />
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Run an analysis on the dashboard to load real step images.
                          </p>
                        </div>
                      )}
                      {/* overlay label */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded glass text-[9px] font-mono font-bold text-primary border border-primary/30">
                          STEP {String(activeStep).padStart(2, "0")}
                        </span>
                        <span className="px-2 py-0.5 rounded glass text-[9px] font-mono text-muted-foreground border border-border/30">
                          {step.time}
                        </span>
                      </div>
                      {/* Expand button */}
                      {imgUrl && (
                        <button
                          onClick={() => setStepModalOpen(true)}
                          className="absolute bottom-2 right-2 size-8 rounded-lg glass border border-border/50 grid place-items-center text-muted-foreground hover:text-primary hover:glow-cyan transition"
                          title="Expand image"
                        >
                          <ZoomIn className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Step Info */}
                  <div className="flex flex-col gap-3">
                    <div className="glass-strong rounded-xl p-4 border border-border/40 flex flex-col gap-3">
                      <div>
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono mb-1">Current Step</div>
                        <div className="text-lg font-bold font-display text-primary">{step.name}</div>
                        <div className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{step.desc}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="glass rounded-lg p-2.5 border border-border/30">
                          <div className="text-[9px] uppercase text-muted-foreground font-mono">Step #</div>
                          <div className="font-display text-primary mt-0.5">{String(activeStep).padStart(2, "0")} / 08</div>
                        </div>
                        <div className="glass rounded-lg p-2.5 border border-border/30">
                          <div className="text-[9px] uppercase text-muted-foreground font-mono">Time</div>
                          <div className="font-display text-[color:var(--neon)] mt-0.5">{step.time}</div>
                        </div>
                      </div>
                      {latestAnalysis?.metrics && (
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="glass rounded-lg p-2.5 border border-border/30">
                            <div className="text-[9px] uppercase text-muted-foreground font-mono">Edge Density</div>
                            <div className="font-display text-foreground mt-0.5">
                              {latestAnalysis.metrics.edge_density_pct ? `${latestAnalysis.metrics.edge_density_pct.toFixed(1)}%` : "—"}
                            </div>
                          </div>
                          <div className="glass rounded-lg p-2.5 border border-border/30">
                            <div className="text-[9px] uppercase text-muted-foreground font-mono">Severity</div>
                            <div className="font-display text-foreground mt-0.5">
                              {latestAnalysis.metrics.defect_severity ?? "—"}
                            </div>
                          </div>
                        </div>
                      )}
                      {/* Nav arrows */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/40">
                        <button
                          onClick={() => setActiveStep(s => Math.max(1, s - 1))}
                          disabled={activeStep === 1}
                          className="flex-1 py-1.5 rounded-lg border border-border/40 text-[10px] font-mono text-muted-foreground hover:text-primary hover:border-primary/40 disabled:opacity-30 transition"
                        >
                          ← Prev
                        </button>
                        <button
                          onClick={() => setActiveStep(s => Math.min(8, s + 1))}
                          disabled={activeStep === 8}
                          className="flex-1 py-1.5 rounded-lg border border-border/40 text-[10px] font-mono text-muted-foreground hover:text-primary hover:border-primary/40 disabled:opacity-30 transition"
                        >
                          Next →
                        </button>
                      </div>
                    </div>

                    {/* Download */}
                    {imgUrl && (
                      <button
                        onClick={() => {
                          const a = document.createElement("a");
                          a.href = imgUrl; a.download = `step${activeStep}_${step.name.toLowerCase().replace(/\s+/g,"_")}.png`;
                          a.target = "_blank"; document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        }}
                        className="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 font-mono text-[11px] tracking-wider transition hover:opacity-90"
                        style={{ background: "linear-gradient(135deg, var(--primary), var(--neon))", color: "oklch(0.12 0.03 260)" }}
                      >
                        <Download className="size-3.5" />
                        Download Step Image
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </section>

        {/* Step Image Lightbox Modal */}
        {stepModalOpen && (() => {
          const step = pipelineSteps.find(s => s.n === activeStep)!;
          const imgUrl = (latestAnalysis as any)?.step_images?.[String(activeStep)] ?? "";
          return (
            <div
              className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md grid place-items-center p-6"
              onClick={() => setStepModalOpen(false)}
            >
              <div
                className="glass-strong rounded-xl w-full max-w-4xl overflow-hidden glow-cyan flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                <header className="flex items-center justify-between px-5 py-3 border-b border-border/60 shrink-0">
                  <div>
                    <div className="text-[10px] tracking-wider uppercase text-muted-foreground font-mono">Pipeline Step {String(activeStep).padStart(2, "0")}</div>
                    <h2 className="text-lg font-display tracking-wide text-glow-cyan">{step.name}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge label={step.time} tone="neon" />
                    <button
                      onClick={() => setActiveStep(s => Math.max(1, s - 1))}
                      disabled={activeStep === 1}
                      className="size-8 rounded-md glass grid place-items-center text-muted-foreground hover:text-primary disabled:opacity-30 transition"
                    >←</button>
                    <button
                      onClick={() => setActiveStep(s => Math.min(8, s + 1))}
                      disabled={activeStep === 8}
                      className="size-8 rounded-md glass grid place-items-center text-muted-foreground hover:text-primary disabled:opacity-30 transition"
                    >→</button>
                    <button
                      onClick={() => setStepModalOpen(false)}
                      className="size-8 rounded-md glass grid place-items-center text-muted-foreground hover:text-[color:var(--critical)] transition"
                    ><X className="size-4" /></button>
                  </div>
                </header>
                <div className="p-6 flex items-center justify-center bg-black/40" style={{ minHeight: 400 }}>
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={`Step ${activeStep}: ${step.name}`}
                      className="max-w-full max-h-[500px] object-contain rounded-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-center">
                      <Sparkles className="size-8 text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">No image yet — run an analysis first.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}


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



/* ══ QUICK UPLOAD BAR ══════════════════════════════════════════════ */
const models = [
  {
    id: "yolo",
    name: "YOLO",
    type: "Real-time Defect Detection",
    accuracy: "97.4%",
    defaultMode: "Full Analysis"
  },
  {
    id: "unet",
    name: "U-Net",
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

/* ═══════════════════════════════════════════════════════════ */
/* WebcamCapture — real getUserMedia + capture → backend      */
/* ═══════════════════════════════════════════════════════════ */
function WebcamCapture({ onResult }: { onResult?: (data: any) => void }) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [streaming, setStreaming]   = useState(false);
  const [capturing, setCapturing]   = useState(false);
  const [camError,  setCamError]    = useState<string | null>(null);
  const [lastResult,setLastResult]  = useState<{ annotated: string; count: number } | null>(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    setCamError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setStreaming(true);
      }
    } catch (err: any) {
      setCamError(err.message || "Camera access denied or unavailable");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current || capturing) return;
    setCapturing(true);
    try {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      const frameB64 = canvas.toDataURL("image/jpeg", 0.85);
      const apiBase  = (import.meta.env.VITE_API_URL as string) || "http://127.0.0.1:8000";
      const res = await fetch(`${apiBase}/webcam/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frame: frameB64 }),
      });
      if (res.ok) {
        const data = await res.json();
        setLastResult({ annotated: data.annotated_image, count: data.defects_count });
        onResult?.(data);
      }
    } catch (e) {
      console.error("[Webcam]", e);
    } finally {
      setCapturing(false);
    }
  };

  if (camError) {
    return (
      <div className="relative rounded-xl overflow-hidden h-[160px] glass-strong flex flex-col items-center justify-center gap-2 text-center p-4">
        <Camera className="size-7 text-muted-foreground" />
        <div className="text-[11px] text-muted-foreground max-w-[180px] leading-relaxed">{camError}</div>
        <button onClick={startCamera} className="px-3 py-1.5 rounded-lg border border-primary/30 text-primary text-[11px] hover:bg-primary/10 transition">
          Retry Camera
        </button>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden h-[160px] glass-strong">
      {/* Live video feed */}
      <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />
      {/* Last annotated result overlay (fades in) */}
      {lastResult?.annotated && (
        <img
          src={lastResult.annotated}
          alt="Annotated"
          className="absolute inset-0 w-full h-full object-cover opacity-70 pointer-events-none animate-in fade-in duration-500"
        />
      )}
      {/* Scan brackets */}
      <div className="absolute inset-4 border border-primary/30 rounded-lg pointer-events-none">
        <CornerBracket pos="tl" /><CornerBracket pos="tr" /><CornerBracket pos="bl" /><CornerBracket pos="br" />
      </div>
      {/* Status bar */}
      <div className="absolute bottom-2 left-3 right-24 flex items-center gap-2">
        <span className="mono-text text-primary/80">{streaming ? "CAM-01 · LIVE" : "Initializing..."}</span>
        {lastResult && (
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: "var(--critical)", color: "white" }}>
            {lastResult.count} defects
          </span>
        )}
      </div>
      {/* Controls */}
      <div className="absolute top-2 right-2 flex gap-1.5">
        <button
          onClick={captureAndAnalyze}
          disabled={!streaming || capturing}
          className="px-2.5 py-1 rounded-lg glass row-desc-text flex items-center gap-1.5 transition disabled:opacity-50"
          style={{ color: "var(--neon)" }}
        >
          {capturing
            ? <><RefreshCcw className="size-3 animate-spin" /> Analyzing...</>
            : <><Camera className="size-3" /> Capture</>}
        </button>
        <button
          onClick={streaming ? stopCamera : startCamera}
          className="px-2.5 py-1 rounded-lg glass row-desc-text flex items-center gap-1.5 text-muted-foreground"
        >
          <Square className="size-2.5" /> {streaming ? "Stop" : "Start"}
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/* CompareMode — upload ref+test → /compare → split slider    */
/* ═══════════════════════════════════════════════════════════ */
interface CompareResult {
  reference: { original_image: string; annotated_image: string; defects_count: number; defects: any[]; inference_time: number };
  test:      { original_image: string; annotated_image: string; defects_count: number; defects: any[]; inference_time: number };
  diff_image:    string;
  similarity_pct: number;
  new_defects:   number;
  fixed_defects: number;
}

function CompareMode({ onResult }: { onResult?: (r: CompareResult) => void }) {
  const [refFile,   setRefFile]    = useState<File | null>(null);
  const [testFile,  setTestFile]   = useState<File | null>(null);
  const [refPrev,   setRefPrev]    = useState<string | null>(null);
  const [testPrev,  setTestPrev]   = useState<string | null>(null);
  const [comparing, setComparing]  = useState(false);
  const [cmpResult, setCmpResult]  = useState<CompareResult | null>(null);
  const [sliderPos, setSliderPos]  = useState(50);
  const [showDiff,  setShowDiff]   = useState(false);
  const refIn  = useRef<HTMLInputElement>(null);
  const testIn = useRef<HTMLInputElement>(null);

  const pickRef  = (f: File) => { setRefFile(f);  setRefPrev(URL.createObjectURL(f));  setCmpResult(null); };
  const pickTest = (f: File) => { setTestFile(f); setTestPrev(URL.createObjectURL(f)); setCmpResult(null); };

  const runCompare = async () => {
    if (!refFile || !testFile) return;
    setComparing(true);
    try {
      const apiBase = (import.meta.env.VITE_API_URL as string) || "http://127.0.0.1:8000";
      const fd = new FormData();
      fd.append("reference", refFile);
      fd.append("test",      testFile);
      const res = await fetch(`${apiBase}/compare`, { method: "POST", body: fd });
      if (res.ok) {
        const data = await res.json() as CompareResult;
        setCmpResult(data);
        onResult?.(data);
      }
    } catch (e) {
      console.error("[Compare]", e);
    } finally {
      setComparing(false);
    }
  };

  /* ── After comparison: show split slider ── */
  if (cmpResult) {
    const leftImg  = showDiff ? cmpResult.diff_image    : cmpResult.reference.annotated_image;
    const rightImg = showDiff ? cmpResult.test.annotated_image : cmpResult.test.annotated_image;
    return (
      <div className="relative rounded-xl overflow-hidden h-[160px] glass-strong select-none">
        {/* Left side — reference */}
        <div className="absolute inset-0">
          {leftImg
            ? <img src={leftImg} className="w-full h-full object-cover" alt="ref" />
            : <div className="w-full h-full bg-black/40 flex items-center justify-center"><span className="text-[10px] text-muted-foreground">No image</span></div>}
        </div>
        {/* Right side — test (clipped) */}
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}>
          {rightImg
            ? <img src={rightImg} className="w-full h-full object-cover" alt="test" />
            : <div className="w-full h-full" />}
        </div>
        {/* Divider */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-primary glow-cyan pointer-events-none" style={{ left: `${sliderPos}%` }}>
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 size-6 rounded-full bg-primary text-primary-foreground grid place-items-center text-[10px] shadow-lg">↔</div>
        </div>
        {/* Labels */}
        <div className="absolute top-1.5 left-2"><Badge label={`REF · ${cmpResult.reference.defects_count}D`} tone="cyan" /></div>
        <div className="absolute top-1.5 right-2"><Badge label={`TEST · ${cmpResult.test.defects_count}D`} tone="violet" /></div>
        {/* Stats bar */}
        <div className="absolute bottom-6 left-2 right-2 flex items-center justify-between">
          <span className="text-[9px] font-mono text-white/70">
            Sim: <span className="text-[color:var(--neon)] font-bold">{cmpResult.similarity_pct.toFixed(1)}%</span>
            {cmpResult.new_defects > 0 && <span className="text-[color:var(--critical)] ml-2">+{cmpResult.new_defects} new</span>}
            {cmpResult.fixed_defects > 0 && <span className="text-[color:var(--neon)] ml-2">-{cmpResult.fixed_defects} fixed</span>}
          </span>
          {cmpResult.diff_image && (
            <button
              onClick={() => setShowDiff(!showDiff)}
              className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-warning/40 text-warning hover:bg-warning/10 transition"
            >
              {showDiff ? "ANNOTATED" : "DIFF MAP"}
            </button>
          )}
          <button
            onClick={() => setCmpResult(null)}
            className="text-[9px] font-mono text-muted-foreground hover:text-foreground transition"
          >Reset</button>
        </div>
        {/* Slider */}
        <input
          type="range" min={0} max={100} value={sliderPos}
          onChange={(e) => setSliderPos(+e.target.value)}
          className="absolute bottom-1 left-4 right-4 accent-[color:var(--cyan)] cursor-ew-resize"
        />
      </div>
    );
  }

  /* ── Before comparison: two upload zones + button ── */
  return (
    <div className="relative rounded-xl overflow-hidden h-[160px] glass-strong flex flex-col gap-1 p-1">
      <div className="flex-1 grid grid-cols-2 gap-1">
        {/* Reference drop zone */}
        <div
          onClick={() => refIn.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && pickRef(e.dataTransfer.files[0]); }}
          className={`relative rounded-lg border border-dashed cursor-pointer flex flex-col items-center justify-center gap-1 transition overflow-hidden ${
            refFile ? "border-[color:var(--cyan)] bg-[color:var(--cyan)]/5" : "border-border/50 hover:border-primary/50 hover:bg-primary/5"
          }`}
        >
          {refPrev && <img src={refPrev} className="absolute inset-0 w-full h-full object-cover opacity-50 rounded-lg" alt="ref-prev" />}
          <div className="relative z-10 flex flex-col items-center gap-0.5">
            <UploadCloud className={`size-4 ${refFile ? "text-[color:var(--cyan)]" : "text-muted-foreground"}`} />
            <span className="text-[9px] font-mono text-muted-foreground">{refFile ? refFile.name.slice(0, 14) : "REFERENCE"}</span>
          </div>
          <input ref={refIn} type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && pickRef(e.target.files[0])} />
        </div>
        {/* Test drop zone */}
        <div
          onClick={() => testIn.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); e.dataTransfer.files[0] && pickTest(e.dataTransfer.files[0]); }}
          className={`relative rounded-lg border border-dashed cursor-pointer flex flex-col items-center justify-center gap-1 transition overflow-hidden ${
            testFile ? "border-[color:var(--violet)] bg-[color:var(--violet)]/5" : "border-border/50 hover:border-primary/50 hover:bg-primary/5"
          }`}
        >
          {testPrev && <img src={testPrev} className="absolute inset-0 w-full h-full object-cover opacity-50 rounded-lg" alt="test-prev" />}
          <div className="relative z-10 flex flex-col items-center gap-0.5">
            <GitCompare className={`size-4 ${testFile ? "text-[color:var(--violet)]" : "text-muted-foreground"}`} />
            <span className="text-[9px] font-mono text-muted-foreground">{testFile ? testFile.name.slice(0, 14) : "TEST WAFER"}</span>
          </div>
          <input ref={testIn} type="file" className="hidden" accept="image/*" onChange={(e) => e.target.files?.[0] && pickTest(e.target.files[0])} />
        </div>
      </div>
      <button
        onClick={runCompare}
        disabled={!refFile || !testFile || comparing}
        className="py-1.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 transition-all hover:opacity-90"
        style={{ background: refFile && testFile ? "linear-gradient(135deg, var(--cyan), var(--violet))" : "var(--panel)", color: refFile && testFile ? "oklch(0.12 0.03 260)" : "var(--muted-foreground)", fontFamily: "var(--font-display)" }}
      >
        {comparing ? <><RefreshCcw className="size-3 animate-spin" /> Analyzing Both Wafers...</> : <><GitCompare className="size-3" /> {refFile && testFile ? "Compare & Detect" : "Upload Both Images"}</>}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/* QuickUploadBar                                             */
/* ═══════════════════════════════════════════════════════════ */
function QuickUploadBar({
  mode,
  setMode,
  ready,
  setReady,
  dragging,
  setDragging,
  fileRef,
  selectedFile,
  setSelectedFile,
  onStartAnalysis,
  loading,
  selectedNode,
  setSelectedNode,
  selectedLayer,
  setSelectedLayer,
  selectedModel,
  setSelectedModel,
  onWebcamResult,
  onCompareResult,
}: {
  mode: UploadMode;
  setMode: (m: UploadMode) => void;
  ready: boolean;
  setReady: (v: boolean) => void;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  onStartAnalysis: () => void;
  loading: boolean;
  selectedNode: string;
  setSelectedNode: (node: string) => void;
  selectedLayer: string;
  setSelectedLayer: (layer: string) => void;
  selectedModel: typeof models[number];
  setSelectedModel: (model: typeof models[number]) => void;
  onWebcamResult?: (data: any) => void;
  onCompareResult?: (data: CompareResult) => void;
}) {
  const tabs: { k: UploadMode; label: string; icon: React.ElementType }[] = [
    { k: "upload",  label: "Upload Image",    icon: UploadCloud },
    { k: "webcam",  label: "Live Webcam",     icon: Camera },
    { k: "compare", label: "Comparison Mode", icon: GitCompare },
  ];

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
    <section className="glass rounded-xl relative z-20">
      <header className="flex items-center justify-between px-5 py-2.5 border-b border-border/60 rounded-t-xl">
        <h3 className="section-title">Quick Upload &amp; Analysis</h3>
        {ready && <Badge label={selectedFile ? selectedFile.name : "Ready to Analyse"} tone="neon" pulse />}
      </header>
      <div className="p-4 grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-5">
          {mode === "upload" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files.length) {
                  setSelectedFile(e.dataTransfer.files[0]);
                  setReady(true);
                }
              }}
              onClick={() => fileRef.current?.click()}
              className={`relative rounded-xl border-2 border-dashed cursor-pointer transition-all h-[160px] grid place-items-center text-center overflow-hidden ${dragging ? "border-primary bg-primary/10 glow-cyan" : ready ? "border-[color:var(--neon)] bg-[color:var(--neon)]/5" : "border-border/60 hover:border-primary/50 hover:bg-primary/5"}`}
            >
              <div className="absolute inset-x-0 top-0 h-px shimmer" />
              <div className="relative flex flex-col items-center gap-2">
                <div className={`size-12 rounded-full glass-strong grid place-items-center transition ${ready ? "glow-neon" : "glow-cyan"}`}>
                  {ready ? <CheckCircle2 className="size-5" style={{ color: "var(--neon)" }} /> : <UploadCloud className="size-5 text-primary" />}
                </div>
                <div className="row-name-text">{ready ? "File Ready — Click to Replace" : "Drop Wafer Image Here"}</div>
                <div className="sub-text text-muted-foreground">{ready ? (selectedFile ? selectedFile.name : "wafer_scan.png") : "JPG · PNG · TIFF · BMP — max 50 MB"}</div>
              </div>
              <input ref={fileRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.tiff,.tif,.bmp" onChange={(e) => {
                if (e.target.files?.length) {
                  setSelectedFile(e.target.files[0]);
                  setReady(true);
                }
              }} />
            </div>
          )}
          {mode === "webcam" && <WebcamCapture onResult={onWebcamResult} />}
          {mode === "compare" && <CompareMode onResult={onCompareResult} />}
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
                <div className="absolute z-50 left-0 right-0 mt-1 bg-popover rounded-lg border border-border/80 overflow-hidden shadow-xl max-h-48 overflow-y-auto auto-scroll animate-fade-in">
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
                <div className="absolute z-50 left-0 right-0 mt-1 bg-popover rounded-lg border border-border/80 overflow-hidden shadow-xl max-h-48 overflow-y-auto auto-scroll animate-fade-in">
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
          <button
            onClick={onStartAnalysis}
            disabled={loading || !ready}
            className="w-full py-3 rounded-xl flex items-center justify-center gap-2 tracking-wide transition-all hover:opacity-90 disabled:opacity-50 hover:glow-cyan"
            style={{ background: "linear-gradient(135deg, var(--primary), var(--neon))", color: "oklch(0.12 0.03 260)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13 }}
          >
            {loading ? <RefreshCcw className="size-4 animate-spin" /> : <Play className="size-4" fill="currentColor" />}
            {loading ? "ANALYZING WAFER..." : "START ANALYSIS"}
          </button>
        </div>
      </div>
    </section>
  );
}

function CornerBracket({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const cls = { tl: "top-0 left-0 border-t-2 border-l-2", tr: "top-0 right-0 border-t-2 border-r-2", bl: "bottom-0 left-0 border-b-2 border-l-2", br: "bottom-0 right-0 border-b-2 border-r-2" }[pos];
  return <span className={`absolute size-3 border-primary ${cls}`} />;
}
