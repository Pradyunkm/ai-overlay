import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Badge, Panel } from "@/components/layout/AppShell";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { runAnalysis, type AnalysisResult, type Defect } from "@/lib/api/analysis";
import {
  UploadCloud, Play, CheckCircle2, AlertTriangle,
  RefreshCcw, X, ZoomIn, Download, Cpu, Clock,
  ShieldAlert, Eye, Crosshair, FileImage, Database, Layers, Check
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SupabaseStatusCard } from "@/components/SupabaseStatusCard";

export const Route = createFileRoute("/_app/upload")({
  head: () => ({ meta: [{ title: "Upload & Test — SDF" }] }),
  component: UploadTest,
});

const nodes  = ["2nm (GAA)", "3nm (EUV)", "5nm (EUV)", "7nm (DUV)", "10nm (DUV)"];
const layers = [
  "Metal Interconnect",
  "Polysilicon Gate",
  "Active Oxide",
  "Via Contact",
  "Photoresist Target",
];

const availableModels = [
  {
    id: "yolo",
    name: "YOLOv11s",
    label: "YOLOv11 — Real-Time Defect Detector",
    description: "Fast bounding box detection & multi-class defect labeling (scratch, crack, overlay shift)",
    type: "Bounding Box Detection",
  },
  {
    id: "unet",
    name: "U-Net++",
    label: "U-Net++ — Deep Pixel Segmentation",
    description: "High-precision pixel segmentation mask for fine wafer overlay anomaly mapping",
    type: "Pixel Segmentation",
  },
];

function UploadTest() {
  const [selectedFile,   setSelectedFile]   = useState<File | null>(null);
  const [preview,        setPreview]        = useState<string | null>(null);
  const [dragging,       setDragging]       = useState(false);
  const [analyzing,      setAnalyzing]      = useState(false);
  const [statusText,     setStatusText]     = useState("");
  // Per-model result slots — stored independently so running one model
  // never erases the other's output.
  const [yoloResult,     setYoloResult]     = useState<AnalysisResult | null>(null);
  const [unetResult,     setUnetResult]     = useState<AnalysisResult | null>(null);
  // Which model's result tab is currently shown in the results panel
  const [activeTab,      setActiveTab]      = useState<"yolo" | "unet">("yolo");
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [selectedNode,   setSelectedNode]   = useState(nodes[3]);
  const [selectedLayer,  setSelectedLayer]  = useState(layers[0]);
  const [selectedModel,  setSelectedModel]  = useState<"yolo" | "unet">("yolo");
  const fileRef = useRef<HTMLInputElement | null>(null);

  // The result for whichever tab is active (may be null if not yet run)
  const result = activeTab === "yolo" ? yoloResult : unetResult;
  const bothReady = yoloResult !== null && unetResult !== null;

  // ── File selection helpers ──────────────────────────────────────────────────
  const handleFile = (file: File) => {
    setSelectedFile(file);
    // Clear both model results when a new file is chosen
    setYoloResult(null);
    setUnetResult(null);
    setSelectedDefect(null);
    // Revoke old preview to avoid memory leak
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(file); });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return null; });
    setYoloResult(null);
    setUnetResult(null);
    setSelectedDefect(null);
    setStatusText("");
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Analysis ───────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast.error("Please select a wafer image first.");
      return;
    }

    setAnalyzing(true);
    setSelectedDefect(null);
    setStatusText(`Starting ${selectedModel.toUpperCase()} AI analysis...`);

    const toastId = toast.loading(`Starting ${selectedModel.toUpperCase()} AI analysis...`);

    try {
      const analysisResult = await runAnalysis({
        file:         selectedFile,
        process_node: selectedNode,
        layer_type:   selectedLayer,
        model_type:   selectedModel,
        onStatus: (msg) => {
          setStatusText(msg);
          toast.loading(msg, { id: toastId });
        },
      });

      // Store result in the correct model slot — never overwrite the other
      if (selectedModel === "yolo") {
        setYoloResult(analysisResult);
      } else {
        setUnetResult(analysisResult);
      }
      // Switch the tab to the model that just finished
      setActiveTab(selectedModel);
      setSelectedDefect(null);

      if (analysisResult.saved_to_supabase) {
        toast.success(`Analysis complete (${selectedModel.toUpperCase()}) — saved to Supabase!`, { id: toastId });
      } else if (!supabase) {
        toast.success(`Analysis complete (${selectedModel.toUpperCase()})! (Local preview mode)`, { id: toastId });
      } else {
        toast.success(`Analysis complete (${selectedModel.toUpperCase()})!`, { id: toastId });
      }
    } catch (err: any) {
      console.error("[Analysis]", err);
      toast.error(`Analysis failed: ${err.message || "Unknown error"}`, { id: toastId });
    } finally {
      setAnalyzing(false);
      setStatusText("");
    }
  };

  const severityTone = result
    ? result.defects_count === 0
      ? ("neon"     as const)
      : result.defects_count <= 3
      ? ("warning"  as const)
      : ("critical" as const)
    : ("cyan" as const);

  // Helper to compute tone for any result (used in comparison strip)
  const getTone = (r: AnalysisResult | null) =>
    !r ? ("cyan" as const)
    : r.defects_count === 0 ? ("neon" as const)
    : r.defects_count <= 3  ? ("warning" as const)
    : ("critical" as const);

  return (
    <>
      <PageHeader title="Upload & Test" crumbs={["Home", "Upload & Test"]} />

      <div className="grid grid-cols-12 gap-4">

        {/* ════════════════════════════════ LEFT PANEL ═══════════════════════ */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">

          {/* ── Dropzone ─────────────────────────────────────────────────── */}
          <section className="glass rounded-xl overflow-hidden">
            <header className="flex items-center justify-between px-5 py-3 border-b border-border/60">
              <h3 className="section-title">Wafer Image Input</h3>
              {selectedFile && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-[color:var(--critical)] transition"
                >
                  <X className="size-3" /> Clear
                </button>
              )}
            </header>

            <div className="p-4">
              {/* Dropzone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`relative rounded-xl border-2 border-dashed transition-all overflow-hidden flex flex-col items-center justify-center gap-3 text-center h-[200px]
                  ${selectedFile
                    ? "border-[color:var(--neon)] bg-[color:var(--neon)]/5"
                    : dragging
                    ? "border-primary bg-primary/10 glow-cyan cursor-copy"
                    : "border-border/60 hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
                  }`}
                onClick={() => !selectedFile && fileRef.current?.click()}
              >
                {/* shimmer line */}
                <div className="absolute inset-x-0 top-0 h-px shimmer" />

                {selectedFile && preview ? (
                  /* Preview */
                  <div className="relative w-full h-full">
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                      <span className="px-2 py-1 rounded glass text-[10px] font-mono text-muted-foreground truncate max-w-[80%]">
                        {selectedFile.name} · {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                      className="absolute top-2 right-2 px-2 py-1 rounded glass text-[10px] text-primary border border-primary/30 hover:glow-cyan transition"
                    >
                      Replace
                    </button>
                  </div>
                ) : (
                  /* Empty state */
                  <div className="flex flex-col items-center gap-3 p-6">
                    <div className={`size-14 rounded-full glass-strong grid place-items-center transition ${dragging ? "glow-cyan" : ""}`}>
                      {dragging
                        ? <FileImage className="size-6 text-primary" />
                        : <UploadCloud className="size-6 text-primary" />}
                    </div>
                    <div>
                      <div className="row-name-text">{dragging ? "Release to Upload" : "Drop Wafer Image Here"}</div>
                      <div className="sub-text text-muted-foreground mt-1">JPG · PNG · TIFF · BMP — max 50 MB</div>
                    </div>
                    <div className="px-4 py-1.5 rounded-lg border border-primary/30 text-primary text-[11px] font-medium">
                      Browse Files
                    </div>
                  </div>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  id="wafer-file-input"
                  accept=".jpg,.jpeg,.png,.tiff,.tif,.bmp"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>
            </div>
          </section>

          {/* ── Configuration & AI Model Selector ────────────────────────── */}
          <section className="glass rounded-xl overflow-hidden">
            <header className="px-5 py-3 border-b border-border/60 flex items-center justify-between">
              <h3 className="section-title">Inspection Configuration</h3>
              <Badge label={selectedModel.toUpperCase()} tone="neon" pulse />
            </header>
            <div className="p-4 space-y-4">

              {/* Model Choice Radio/Cards */}
              <div>
                <label className="col-label-text text-muted-foreground block mb-2 font-mono">
                  Select AI Architecture
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {availableModels.map((m) => {
                    const isSelected = selectedModel === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSelectedModel(m.id as "yolo" | "unet")}
                        className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? "bg-primary/10 border-primary glow-cyan"
                            : "glass border-border/40 hover:border-primary/40 hover:bg-white/[0.02]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-display font-bold text-xs text-foreground flex items-center gap-1.5">
                            <Cpu className={`size-3.5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                            {m.name}
                          </span>
                          {isSelected && <Check className="size-3.5 text-primary" />}
                        </div>
                        <span className="text-[9.5px] text-muted-foreground leading-snug line-clamp-2">
                          {m.type}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Node & Layer Selectors */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="node-select" className="col-label-text text-muted-foreground block mb-1.5">Process Node</label>
                  <select
                    id="node-select"
                    value={selectedNode}
                    onChange={(e) => setSelectedNode(e.target.value)}
                    className="w-full glass-strong rounded-lg px-3 py-2 row-desc-text text-foreground border border-transparent hover:border-primary/30 focus:border-primary focus:outline-none transition bg-transparent"
                  >
                    {nodes.map((n) => <option key={n} value={n} className="bg-[oklch(0.19_0.03_260)]">{n}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="layer-select" className="col-label-text text-muted-foreground block mb-1.5">Layer Type</label>
                  <select
                    id="layer-select"
                    value={selectedLayer}
                    onChange={(e) => setSelectedLayer(e.target.value)}
                    className="w-full glass-strong rounded-lg px-3 py-2 row-desc-text text-foreground border border-transparent hover:border-primary/30 focus:border-primary focus:outline-none transition bg-transparent"
                  >
                    {layers.map((l) => <option key={l} value={l} className="bg-[oklch(0.19_0.03_260)]">{l}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="px-4 pb-4">
              <button
                id="start-analysis-btn"
                onClick={handleAnalyze}
                disabled={analyzing || !selectedFile}
                className="w-full py-3 rounded-xl flex items-center justify-center gap-2.5 font-display font-bold tracking-wider text-[13px] transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed hover:glow-cyan"
                style={{
                  background: "linear-gradient(135deg, var(--primary), var(--neon))",
                  color: "oklch(0.12 0.03 260)",
                }}
              >
                {analyzing
                  ? <><RefreshCcw className="size-4 animate-spin" /> ANALYZING WITH {selectedModel.toUpperCase()}...</>
                  : <><Play className="size-4" fill="currentColor" /> RUN {selectedModel.toUpperCase()} ANALYSIS</>}
              </button>
            </div>
          </section>

          {/* ── Supabase Status Card ──────────────────────────────────────── */}
          <SupabaseStatusCard compact />

          {/* ── Result KPI strip ──────────────────────────────────────────── */}
          {(yoloResult || unetResult) && (
            <div className="flex flex-col gap-3 animate-in fade-in duration-500">
              {/* When both are ready show a compact comparison row */}
              {bothReady && (
                <div className="glass rounded-xl p-3 border border-border/40">
                  <div className="text-[9px] uppercase tracking-wider font-mono text-muted-foreground mb-2">Model Comparison</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(["yolo", "unet"] as const).map((m) => {
                      const r = m === "yolo" ? yoloResult! : unetResult!;
                      const tone = getTone(r);
                      const color = tone === "neon" ? "var(--neon)" : tone === "warning" ? "var(--warning)" : tone === "critical" ? "var(--critical)" : "var(--cyan)";
                      return (
                        <button
                          key={m}
                          onClick={() => { setActiveTab(m); setSelectedDefect(null); }}
                          className={`p-2.5 rounded-lg border text-left transition-all ${
                            activeTab === m
                              ? "border-primary/60 bg-primary/10"
                              : "border-border/30 hover:border-primary/30 hover:bg-white/[0.02]"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-mono font-bold" style={{ color }}>{m.toUpperCase()}</span>
                            {activeTab === m && <Check className="size-3 text-primary" />}
                          </div>
                          <div className="font-display font-bold text-sm" style={{ color }}>
                            {r.defects_count} defect{r.defects_count !== 1 ? "s" : ""}
                          </div>
                          <div className="text-[9px] text-muted-foreground font-mono">{r.inference_time.toFixed(3)}s</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* KPI cards for the active result */}
              {result && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Detections",     value: String(result.defects_count),          icon: ShieldAlert, tone: severityTone },
                    { label: "Inference Time", value: `${result.inference_time.toFixed(3)}s`, icon: Clock,       tone: "neon" as const },
                    { label: "Model",          value: (result.model_type || activeTab).toUpperCase(), icon: Cpu, tone: "cyan" as const },
                    { label: "Status",         value: result.defects_count === 0 ? "Clean" : "Defective", icon: Eye, tone: severityTone },
                  ].map((s) => {
                    const color = s.tone === "neon" ? "var(--neon)" : s.tone === "warning" ? "var(--warning)" : s.tone === "critical" ? "var(--critical)" : "var(--cyan)";
                    const Icon  = s.icon;
                    return (
                      <div
                        key={s.label}
                        className="glass rounded-xl p-3 flex items-center gap-3"
                        style={{ borderLeft: `2px solid ${color}` }}
                      >
                        <div
                          className="size-8 rounded-lg grid place-items-center shrink-0"
                          style={{ background: `color-mix(in oklab, ${color} 12%, transparent)`, border: `1px solid color-mix(in oklab, ${color} 28%, transparent)` }}
                        >
                          <Icon className="size-4" style={{ color }} />
                        </div>
                        <div>
                          <div className="label-text text-muted-foreground">{s.label}</div>
                          <div className="font-display font-bold text-sm" style={{ color }}>{s.value}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ════════════════════════════════ RIGHT PANEL ══════════════════════ */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-4">

          {/* ── Idle state ───────────────────────────────────────────────── */}
          {!yoloResult && !unetResult && !analyzing && (
            <div className="glass rounded-xl flex-1 min-h-[400px] flex flex-col items-center justify-center gap-4 text-center p-10">
              <div className="size-20 rounded-2xl glass-strong grid place-items-center glow-cyan animate-pulse">
                <Crosshair className="size-9 text-primary" />
              </div>
              <div>
                <div className="panel-title mb-2">Awaiting Wafer Scan</div>
                <div className="sub-text text-muted-foreground max-w-xs leading-relaxed">
                  Upload a semiconductor wafer image and click <strong>Start AI Analysis</strong> to run
                  real-time defect detection using YOLOv11.
                </div>
              </div>
              <div className="flex gap-2 flex-wrap justify-center">
                {["Overlay Mismatch", "Edge Deformation", "Pattern Damage", "Contamination"].map((t) => (
                  <span key={t} className="px-2.5 py-1 rounded-lg border border-border/40 text-[10px] text-muted-foreground">{t}</span>
                ))}
              </div>
            </div>
          )}

          {/* ── Analyzing state ──────────────────────────────────────────── */}
          {analyzing && (
            <div className="glass rounded-xl flex-1 min-h-[400px] flex flex-col items-center justify-center gap-5">
              <div className="relative size-24">
                <svg className="absolute inset-0 animate-spin" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="44" fill="none" stroke="var(--primary)" strokeWidth="2"
                    strokeDasharray="80 200" strokeLinecap="round" opacity="0.7" />
                </svg>
                <div className="absolute inset-4 rounded-full glass-strong grid place-items-center glow-cyan">
                  <Cpu className="size-8 text-primary animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <div className="panel-title mb-1.5">AI Inference Running</div>
                <div className="sub-text text-muted-foreground max-w-xs">
                  {statusText || "YOLOv11 scanning wafer for overlay defects..."}
                </div>
              </div>
              <div className="flex flex-col gap-2 w-72">
                {[
                  "Preprocessing image",
                  "Running YOLO inference",
                  "Extracting detections",
                  "Uploading to storage",
                  "Saving to database",
                ].map((step, i) => (
                  <div key={step} className="flex items-center gap-2 text-[11px]">
                    <RefreshCcw className="size-3 text-primary animate-spin shrink-0"
                      style={{ animationDelay: `${i * 0.25}s` }} />
                    <span className="text-muted-foreground">{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Results state ────────────────────────────────────────────── */}
          {(yoloResult || unetResult) && !analyzing && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-500">

              {/* ── Model Tab Switcher (shown when both are ready) ────── */}
              {bothReady && (
                <div className="flex gap-1 glass rounded-xl p-1">
                  {(["yolo", "unet"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => { setActiveTab(m); setSelectedDefect(null); }}
                      className={`flex-1 py-2 rounded-lg text-[11px] font-display font-bold tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                        activeTab === m
                          ? "bg-primary/20 text-primary border border-primary/40"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/[0.03]"
                      }`}
                    >
                      <Cpu className="size-3" />
                      {m === "yolo" ? "YOLOv11" : "U-Net++"}
                      {m === "yolo" && yoloResult && (
                        <span className={`px-1 py-0.5 rounded text-[8px] font-mono ${
                          activeTab === m ? "bg-primary/20" : "bg-border/40"
                        }`}>{yoloResult.defects_count}</span>
                      )}
                      {m === "unet" && unetResult && (
                        <span className={`px-1 py-0.5 rounded text-[8px] font-mono ${
                          activeTab === m ? "bg-primary/20" : "bg-border/40"
                        }`}>{unetResult.defects_count}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Active result (null when the other tab hasn't been run) ── */}
              {!result && (
                <div className="glass rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-center">
                  <Crosshair className="size-8 text-muted-foreground" />
                  <div className="sub-text text-muted-foreground">
                    Run {activeTab === "yolo" ? "YOLOv11" : "U-Net++"} to see its results here.
                  </div>
                </div>
              )}

              {result && (<>

              {/* Side-by-side images */}
              <Panel
                title="AI Analysis Results"
                subtitle={`${result.filename} · ${result.process_node} · ${result.layer_type}`}
                action={
                  <div className="flex gap-2 items-center">
                    {result.saved_to_supabase
                      ? <Badge label="SUPABASE SAVED" tone="neon" pulse />
                      : <Badge label="LOCAL PREVIEW" tone="warning" />}
                    <Badge
                      label={`${result.defects_count} DEFECT${result.defects_count !== 1 ? "S" : ""}`}
                      tone={severityTone}
                    />
                  </div>
                }
              >
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {/* Original */}
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] uppercase tracking-wider font-mono text-muted-foreground">
                      Original Scan
                    </div>
                    <div className="relative aspect-square rounded-lg overflow-hidden glass-strong border border-border/50 bg-black/30 flex items-center justify-center">
                      <img
                        src={result.original_image}
                        alt="Original wafer scan"
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  </div>

                  {/* Annotated */}
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] uppercase tracking-wider font-mono text-primary">
                      AI Annotated Output
                    </div>
                    <div className="relative aspect-square rounded-lg overflow-hidden glass-strong border border-border/50 bg-black/30 flex items-center justify-center scanline">
                      <img
                        src={result.annotated_image}
                        alt="YOLO annotated defect map"
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    </div>
                  </div>
                </div>

                {/* Download row */}
                <div className="flex gap-2">
                  <a
                    href={result.annotated_image}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="flex-1 py-2 rounded-lg border border-primary/30 text-primary text-[11px] font-medium flex items-center justify-center gap-1.5 hover:bg-primary/10 hover:glow-cyan transition"
                  >
                    <Download className="size-3.5" /> Download Annotated
                  </a>
                  <a
                    href={result.original_image}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="flex-1 py-2 rounded-lg border border-border/40 text-muted-foreground text-[11px] font-medium flex items-center justify-center gap-1.5 hover:bg-white/5 transition"
                  >
                    <Download className="size-3.5" /> Download Original
                  </a>
                </div>
              </Panel>

              {/* Defects table */}
              <section className="glass rounded-xl overflow-hidden">
                <header className="flex items-center justify-between px-5 py-3 border-b border-border/60">
                  <h3 className="section-title">Detected Defects</h3>
                  <Badge label={`${result.defects_count} found`} tone={severityTone} />
                </header>

                {result.defects.length === 0 ? (
                  <div className="py-10 flex flex-col items-center gap-3 text-center px-6">
                    <CheckCircle2 className="size-10 text-[color:var(--neon)]" />
                    <div>
                      <div className="font-display font-semibold text-[color:var(--neon)]">No Defects Detected</div>
                      <div className="sub-text text-muted-foreground mt-1">
                        Wafer passed AI inspection. No overlay anomalies identified.
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Table header */}
                    <div className="grid grid-cols-12 px-4 py-2.5 border-b border-border/40 col-label-text text-muted-foreground text-[9px]">
                      <div className="col-span-2 text-center">Crop</div>
                      <div className="col-span-4">Label</div>
                      <div className="col-span-3">Coords (px)</div>
                      <div className="col-span-2 text-right">Confidence</div>
                      <div className="col-span-1" />
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-border/20 max-h-[280px] overflow-y-auto">
                      {result.defects.map((d, i) => (
                        <div
                          key={i}
                          onClick={() => setSelectedDefect(selectedDefect === d ? null : d)}
                          className={`grid grid-cols-12 items-center px-4 py-2.5 cursor-pointer transition-colors hover:bg-white/[0.03] ${
                            selectedDefect === d
                              ? "bg-primary/10 border-l-2 border-l-primary"
                              : ""
                          }`}
                        >
                          <div className="col-span-2 flex justify-center">
                            {d.crop_image ? (
                              <img
                                src={d.crop_image}
                                alt={`Defect ${i + 1}`}
                                className="w-8 h-8 rounded object-cover border border-border/60 bg-black/40 hover:scale-110 transition-transform"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded border border-border/40 flex items-center justify-center">
                                <AlertTriangle className="size-3.5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="col-span-4">
                            <div className="text-xs font-semibold text-foreground capitalize">
                              {d.label || `Class ${d.class_id}`}
                            </div>
                            <div className="text-[9px] text-muted-foreground font-mono">ID #{d.class_id}</div>
                          </div>
                          <div className="col-span-3 font-mono text-[9px] text-muted-foreground">
                            [{d.box.map((v) => Math.round(v)).join(", ")}]
                          </div>
                          <div className="col-span-2 text-right font-mono text-[11px] font-semibold text-[color:var(--neon)]">
                            {(d.confidence * 100).toFixed(1)}%
                          </div>
                          <div className="col-span-1 flex justify-end">
                            <ZoomIn className="size-3.5 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              {/* Defect spotlight */}
              {selectedDefect && (
                <div className="glass-strong rounded-xl p-4 border border-primary/30 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-primary font-mono">
                      Defect Spotlight
                    </span>
                    <button
                      onClick={() => setSelectedDefect(null)}
                      className="text-[10px] text-muted-foreground hover:text-foreground font-mono"
                    >
                      Dismiss
                    </button>
                  </div>
                  <div className="flex gap-4 items-center">
                    <div className="relative size-20 shrink-0 rounded-lg overflow-hidden border border-border/80 bg-black/60 flex items-center justify-center scanline">
                      {selectedDefect.crop_image ? (
                        <img src={selectedDefect.crop_image} alt="Defect zoom" className="w-full h-full object-cover" />
                      ) : (
                        <AlertTriangle className="size-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-2 text-[11px]">
                      <div>
                        <div className="text-muted-foreground text-[9px] uppercase tracking-wider mb-0.5">Label</div>
                        <div className="font-semibold capitalize text-foreground">{selectedDefect.label || "Unknown"}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[9px] uppercase tracking-wider mb-0.5">Confidence</div>
                        <div className="font-mono font-semibold text-[color:var(--neon)]">
                          {(selectedDefect.confidence * 100).toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[9px] uppercase tracking-wider mb-0.5">Class ID</div>
                        <div className="font-mono text-primary">#{selectedDefect.class_id}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground text-[9px] uppercase tracking-wider mb-0.5">BBox (xyxy)</div>
                        <div className="font-mono text-muted-foreground">
                          [{selectedDefect.box.map((v) => Math.round(v)).join(", ")}]
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              </>) /* end result && */}
            </div>
          )} {/* end (yoloResult || unetResult) && !analyzing */}
        </div>
      </div>
    </>
  );
}
