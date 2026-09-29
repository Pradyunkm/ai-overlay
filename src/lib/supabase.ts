import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Read Supabase environment variables from client-side config
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

// Check if credentials exist and match expected formats
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith("http") &&
  supabaseUrl.includes("supabase")
);

// Initialize Supabase Client safely
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    })
  : null;

if (!supabase) {
  console.info(
    "[Supabase] Credentials not set in .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY). Running in Local Storage Mode."
  );
}

export interface SupabaseHealthStatus {
  configured: boolean;
  connected: boolean;
  bucketReady: boolean;
  tableReady: boolean;
  message: string;
  supabaseUrl: string;
  bucketName: string;
  tableName: string;
}

/**
 * Diagnostic helper to test Supabase client connection, storage bucket, and table setup.
 */
export async function checkSupabaseHealth(): Promise<SupabaseHealthStatus> {
  const result: SupabaseHealthStatus = {
    configured: isSupabaseConfigured,
    connected: false,
    bucketReady: false,
    tableReady: false,
    message: isSupabaseConfigured
      ? "Checking Supabase connection..."
      : "Supabase not configured in .env (Local Preview Mode)",
    supabaseUrl: supabaseUrl || "Not set",
    bucketName: "wafer-inspections",
    tableName: "inspections",
  };

  if (!supabase) {
    return result;
  }

  try {
    // 1. Test database table accessibility
    const { error: tableErr } = await supabase
      .from("inspections")
      .select("id")
      .limit(1);

    if (tableErr) {
      if (tableErr.code === "42P01" || tableErr.message.includes("relation") || tableErr.message.includes("does not exist")) {
        result.message = "Connected to Supabase, but 'inspections' table does not exist yet.";
      } else {
        result.message = `Supabase DB Notice: ${tableErr.message}`;
      }
    } else {
      result.tableReady = true;
      result.connected = true;
    }

    // 2. Test storage bucket accessibility
    const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
    if (!bucketErr && buckets) {
      const found = buckets.some((b) => b.name === result.bucketName);
      if (found) {
        result.bucketReady = true;
      } else {
        result.message = `Supabase connected, but '${result.bucketName}' bucket not found. Create a public bucket in Supabase Storage.`;
      }
    } else if (bucketErr) {
      // Storage access might be restricted by RLS or bucket list permission
      result.message = `Supabase Storage Notice: ${bucketErr.message}`;
    }

    if (result.tableReady && result.bucketReady) {
      result.connected = true;
      result.message = "Supabase Cloud DB & Storage fully connected and operational!";
    } else if (result.tableReady) {
      result.connected = true;
      result.message = "Supabase DB connected! (Storage bucket 'wafer-inspections' needs setup)";
    }
  } catch (err: any) {
    result.connected = false;
    result.message = `Supabase Connection Error: ${err.message || "Failed to reach Supabase server"}`;
  }

  return result;
}

