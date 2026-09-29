/**
 * Backend API client — typed fetch wrappers for all FastAPI endpoints.
 * VITE_API_URL env var, defaults to http://127.0.0.1:8000
 */

const API_BASE = (import.meta.env.VITE_API_URL as string) || "http://127.0.0.1:8000";

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

// ─── Response types ────────────────────────────────────────────────────────

export interface DashboardStats {
  total_inspections: number;
  total_defects: number;
  avg_inference_time: number;
  critical_defects: number;
  avg_confidence_pct: number;
  yield_pct: number;
  wafers_processed: number;
  latest_metrics: Record<string, number>;
}

export interface OverlayAnalysis {
  overlay_shift: number;
  overlay_x: number;
  overlay_y: number;
  rotation_misalignment: number;
  edge_placement_error: number;
  alignment_confidence: number;
  avg_overlay_shift: number;
  avg_rotation: number;
  avg_epe: number;
  avg_alignment_conf: number;
  trend: { t: string; shift: number }[];
}

export interface DefectsAnalytics {
  total_defects: number;
  classes: { name: string; n: number; pct: number; color: string }[];
  severity_dist: { name: string; value: number; color: string }[];
  trend: { t: string; v: number }[];
}

export interface ProcessHealth {
  wafer_yield: number;
  drift_score: number;
  temp_variation: number;
  oxidation_delta: number;
  overlay_shift: number;
  severity_score: number;
  process_stability: number;
  alignment_score: number;
  drift_trend: { t: string; v: number }[];
  yield_trend: { t: string; v: number }[];
  parameters: Record<string, string>;
}

export interface PredictiveRisk {
  risk_pct: number;
  risk_label: string;
  forecast_24h: number;
  trend: { t: string; v: number }[];
}

export interface SystemStatus {
  cpu_pct: number;
  ram_pct: number;
  ram_used_gb: number;
  ram_total_gb: number;
  gpu_util: number | null;
  vram_used: number | null;
  vram_total: number | null;
  gpu_temp: number | null;
  gpu_name: string;
  uptime: string;
  uptime_secs: number;
  model_version: string;
  model_loaded: boolean;
  server_status: string;
  logs: { time: string; level: string; message: string }[];
}

export interface ReportItem {
  id: string;
  db_id: number;
  title: string;
  inspection_id: number;
  pdf_url: string;
  size_kb: number;
  size_str: string;
  date: string;
  status: string;
}

export interface ReportsList {
  reports: ReportItem[];
  total: number;
}

export interface GenerateReportResult {
  success: boolean;
  title: string;
  pdf_url: string;
  size_kb: number;
}

// ─── API functions ─────────────────────────────────────────────────────────

export const fetchDashboardStats   = () => apiFetch<DashboardStats>("/dashboard/stats");
export const fetchOverlayAnalysis  = () => apiFetch<OverlayAnalysis>("/overlay/analysis");
export const fetchDefectsAnalytics = () => apiFetch<DefectsAnalytics>("/defects/analytics");
export const fetchProcessHealth    = () => apiFetch<ProcessHealth>("/process/health");
export const fetchPredictiveRisk   = () => apiFetch<PredictiveRisk>("/predictive/risk");
export const fetchSystemStatus     = () => apiFetch<SystemStatus>("/system/status");
export const fetchReportsList      = () => apiFetch<ReportsList>("/reports/list");
export const generateReport        = () =>
  apiFetch<GenerateReportResult>("/reports/generate", { method: "POST" });

export function getReportDownloadUrl(pdfUrl: string): string {
  if (pdfUrl.startsWith("http")) return pdfUrl;
  return `${API_BASE}${pdfUrl}`;
}

// ─── WebSocket: auto-reconnecting live feed ────────────────────────────────

export class LiveSocket {
  private ws: WebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly url: string;
  public onMessage: ((data: Record<string, unknown>) => void) | null = null;
  public onConnect: (() => void) | null = null;
  public onDisconnect: (() => void) | null = null;

  constructor() {
    const wsBase = API_BASE.replace(/^https?/, (p) => (p === "https" ? "wss" : "ws"));
    this.url = `${wsBase}/ws/live`;
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);
      this.ws.onopen  = () => { this.onConnect?.(); if (this.timer) { clearTimeout(this.timer); this.timer = null; } };
      this.ws.onmessage = (ev) => { try { this.onMessage?.(JSON.parse(ev.data as string)); } catch {} };
      this.ws.onclose = () => { this.onDisconnect?.(); this.timer = setTimeout(() => this.connect(), 3000); };
      this.ws.onerror = () => { this.ws?.close(); };
    } catch {}
  }

  disconnect() {
    if (this.timer) clearTimeout(this.timer);
    this.ws?.close();
    this.ws = null;
  }
}
