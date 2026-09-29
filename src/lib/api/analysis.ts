/**
 * Centralized AI analysis API client.
 *
 * Flow:
 *  1. POST image to FastAPI backend (/upload)
 *  2. Receive step_images, annotated_image, defect list, inference_time, metrics
 *  3. Optionally persist everything to Supabase Storage + DB
 *  4. Return a normalised AnalysisResult ready for the UI
 */

import { supabase } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Defect {
  box: number[];
  confidence: number;
  class_id: number;
  label: string;
  crop_image?: string;
}

/** Metrics derived from the real image by the backend */
export interface WaferMetrics {
  overlay_shift: number;
  overlay_x: number;
  overlay_y: number;
  rotation_misalignment: number;
  edge_placement_error: number;
  alignment_confidence: number;
  defect_severity: string;   // "None" | "Low" | "Medium" | "High" | "Critical"
  severity_score: number;
  mean_intensity: number;
  std_dev: number;
  edge_density_pct: number;
}

/**
 * step_images[n] = public URL for pipeline step n
 * 1=Original, 2=Grayscale, 3=Blur, 4=Edges, 5=Contours, 6=Diff, 7=Heatmap, 8=Annotated
 */
export type StepImages = Record<string, string>;

export interface AnalysisResult {
  filename: string;
  original_image: string;
  annotated_image: string;
  defects_count: number;
  defects: Defect[];
  inference_time: number;
  process_node: string;
  layer_type: string;
  model_type?: string;
  /** Intermediate pipeline step image URLs */
  step_images: StepImages;
  /** Real computed KPI metrics */
  metrics: Partial<WaferMetrics>;
  /** Defect density heatmap image URL (server-generated) */
  density_map?: string;
  /** Wafer yield % computed from this scan (0–100) */
  wafer_yield?: number;
  /** Predicted failure risk % for this scan (0–100) */
  failure_risk?: number;
  /** Human-readable risk label */
  risk_label?: string;
  /** true when the row was persisted to Supabase */
  saved_to_supabase: boolean;
}

export interface AnalysisOptions {
  file: File;
  process_node: string;
  layer_type: string;
  model_type?: string;
  /** Callback to update UI with intermediate status text */
  onStatus?: (msg: string) => void;
}

// ─── Helper: fetch a URL and return a Blob ────────────────────────────────────

async function fetchBlob(url: string): Promise<Blob | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.blob();
  } catch {
    return null;
  }
}

// ─── Helper: upload a Blob to Supabase Storage ───────────────────────────────

async function uploadToSupabase(
  bucket: string,
  path: string,
  blob: Blob,
  contentType: string
): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { contentType, cacheControl: "3600", upsert: false });
    if (error) {
      console.warn("[Supabase Storage Notice]", error.message);
      return null;
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  } catch (e: any) {
    console.warn("[Supabase Storage Exception]", e?.message || e);
    return null;
  }
}

// ─── Main analysis function ───────────────────────────────────────────────────

export async function runAnalysis(opts: AnalysisOptions): Promise<AnalysisResult> {
  const { file, process_node, layer_type, model_type = "yolo", onStatus } = opts;

  const apiBase = (import.meta.env.VITE_API_URL as string) || "http://127.0.0.1:8000";

  // ── 1. POST to backend ──────────────────────────────────────────────────────
  onStatus?.(`Sending wafer scan to AI backend (${model_type.toUpperCase()} model)...`);
  const formData = new FormData();
  formData.append("file", file);
  formData.append("model_type", model_type);

  let response: Response;
  try {
    response = await fetch(`${apiBase}/upload`, { method: "POST", body: formData });
  } catch (networkErr: any) {
    throw new Error(
      `Cannot reach the AI backend at ${apiBase}. ` +
      `Make sure the FastAPI server is running (uvicorn main:app) or set VITE_API_URL to your Render URL.`
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`Backend error ${response.status}: ${text}`);
  }

  const data = await response.json();

  let originalUrl  = data.original_image  as string;
  let annotatedUrl = data.annotated_image as string;
  let finalDefects = (data.defects ?? []) as Defect[];
  const stepImages = (data.step_images ?? {}) as StepImages;

  const ts  = Date.now();
  const ext = file.name.split(".").pop() || "png";
  let saved_to_supabase = false;

  // ── 2. Supabase persistence (optional) ─────────────────────────────────────
  if (supabase) {
    try {
      onStatus?.("Uploading original scan to Supabase Storage...");
      const origPath = `original_${ts}.${ext}`;
      const origUrl  = await uploadToSupabase(
        "wafer-inspections", origPath, file, file.type || `image/${ext}`
      );
      if (origUrl) originalUrl = origUrl;

      onStatus?.("Uploading annotated image to Supabase Storage...");
      const annBlob = await fetchBlob(data.annotated_image);
      let annUrl: string | null = null;
      if (annBlob) {
        annUrl = await uploadToSupabase("wafer-inspections", `annotated_${ts}.png`, annBlob, "image/png");
        if (annUrl) annotatedUrl = annUrl;
      }

      // Upload crop thumbnails
      const updatedDefects = [...finalDefects];
      if (data.defects?.length > 0) {
        onStatus?.("Uploading defect crop images...");
        for (let i = 0; i < data.defects.length; i++) {
          const d = data.defects[i] as Defect;
          if (d.crop_image) {
            const cropBlob = await fetchBlob(d.crop_image);
            if (cropBlob) {
              const cropUrl = await uploadToSupabase(
                "wafer-inspections", `crop_${i}_${ts}.png`, cropBlob, "image/png"
              );
              if (cropUrl) updatedDefects[i] = { ...d, crop_image: cropUrl };
            }
          }
        }
        finalDefects = updatedDefects;
      }

      onStatus?.("Saving inspection to Supabase DB...");
      const { error: dbErr } = await supabase.from("inspections").insert({
        filename:       file.name,
        original_url:   origUrl  ?? originalUrl,
        annotated_url:  annUrl   ?? annotatedUrl,
        defects_count:  data.defects_count,
        defects:        finalDefects,
        inference_time: data.inference_time,
        metrics:        data.metrics ?? {},
        process_node,
        layer_type,
        created_at:     new Date().toISOString(),
      });

      if (dbErr) {
        console.warn("[Supabase DB Notice]", dbErr.message);
      } else {
        saved_to_supabase = true;
      }

    } catch (supaErr) {
      console.info("[Supabase Operations Bypassed]", supaErr);
    }
  }

  return {
    filename:        file.name,
    original_image:  originalUrl,
    annotated_image: annotatedUrl,
    defects_count:   data.defects_count ?? 0,
    defects:         finalDefects,
    inference_time:  data.inference_time ?? 0,
    process_node,
    layer_type,
    model_type,
    step_images:     stepImages,
    metrics:         data.metrics ?? {},
    density_map:     (data.density_map as string) || (stepImages["density"] as string) || undefined,
    wafer_yield:     data.wafer_yield  as number | undefined,
    failure_risk:    data.failure_risk as number | undefined,
    risk_label:      data.risk_label   as string | undefined,
    saved_to_supabase,
  };
}

// ─── Load past inspections from Supabase or Fallback ─────────────────────────

export async function fetchInspections(limit = 20): Promise<AnalysisResult[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("inspections")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (!error && data && data.length > 0) {
        return data.map((row: any) => ({
          filename:         row.filename,
          original_image:   row.original_url,
          annotated_image:  row.annotated_url,
          defects_count:    row.defects_count,
          defects:          row.defects ?? [],
          inference_time:   row.inference_time,
          process_node:     row.process_node || "7nm",
          layer_type:       row.layer_type || "Metal",
          model_type:       row.model_type || "yolo",
          step_images:      {},
          metrics:          row.metrics ?? {},
          saved_to_supabase: true,
        }));
      }
    } catch (err) {
      console.warn("[Supabase Fetch Notice]", err);
    }
  }

  return [];
}

