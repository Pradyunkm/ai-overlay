import React, { useState, useEffect } from "react";
import { isSupabaseConfigured, checkSupabaseHealth, type SupabaseHealthStatus } from "@/lib/supabase";
import { Database, RefreshCw, CheckCircle2, AlertTriangle, CloudOff, Info, HelpCircle } from "lucide-react";
import { Badge } from "@/components/layout/AppShell";

interface SupabaseStatusCardProps {
  compact?: boolean;
  className?: string;
}

export function SupabaseStatusCard({ compact = false, className = "" }: SupabaseStatusCardProps) {
  const [health, setHealth] = useState<SupabaseHealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const runHealthCheck = async () => {
    setLoading(true);
    try {
      const res = await checkSupabaseHealth();
      setHealth(res);
    } catch {
      setHealth({
        configured: isSupabaseConfigured,
        connected: false,
        bucketReady: false,
        tableReady: false,
        message: "Failed to run Supabase diagnostic check",
        supabaseUrl: "Unknown",
        bucketName: "wafer-inspections",
        tableName: "inspections",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runHealthCheck();
  }, []);

  if (compact) {
    const isReady = health?.connected && health?.bucketReady;
    const isPartial = health?.tableReady || health?.connected;
    return (
      <div className={`glass-strong rounded-lg p-2.5 flex items-center justify-between border ${className}`}>
        <div className="flex items-center gap-2 min-w-0">
          <Database
            className="size-4 shrink-0"
            style={{
              color: isReady
                ? "var(--neon)"
                : isPartial
                ? "var(--warning)"
                : "var(--muted-foreground)",
            }}
          />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-foreground truncate">Supabase Cloud</span>
            <span className="text-[9.5px] text-muted-foreground truncate">
              {health?.message || "Checking status..."}
            </span>
          </div>
        </div>
        <Badge
          label={isReady ? "CONNECTED" : isPartial ? "PARTIAL" : "LOCAL MODE"}
          tone={isReady ? "neon" : isPartial ? "warning" : "cyan"}
        />
      </div>
    );
  }

  const isConnected = Boolean(health?.connected);
  const isBucketReady = Boolean(health?.bucketReady);
  const isTableReady = Boolean(health?.tableReady);

  return (
    <section className={`glass rounded-xl overflow-hidden ${className}`}>
      <header className="flex items-center justify-between px-5 py-3.5 border-b border-border/60">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-lg grid place-items-center bg-primary/10 border border-primary/30">
            <Database className="size-4 text-primary" />
          </div>
          <div>
            <h3 className="section-title">Supabase Integration & Database</h3>
            <p className="sub-text text-muted-foreground mt-0.5">
              Cloud storage for wafer images & inspection records
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={runHealthCheck}
            disabled={loading}
            className="p-1.5 rounded-lg border border-border/40 hover:border-primary/40 text-muted-foreground hover:text-primary transition"
            title="Refresh connection status"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <Badge
            label={isConnected && isBucketReady ? "FULLY CONNECTED" : isConnected ? "DB CONNECTED" : "LOCAL FALLBACK MODE"}
            tone={isConnected && isBucketReady ? "neon" : isConnected ? "warning" : "cyan"}
            pulse={isConnected}
          />
        </div>
      </header>

      <div className="p-4 space-y-4 text-xs">
        {/* Connection status banner */}
        <div
          className={`p-3.5 rounded-lg border flex items-start gap-3 ${
            isConnected && isBucketReady
              ? "bg-[color:var(--neon)]/10 border-[color:var(--neon)]/30 text-foreground"
              : isConnected
              ? "bg-[color:var(--warning)]/10 border-[color:var(--warning)]/30 text-foreground"
              : "bg-primary/5 border-primary/20 text-foreground"
          }`}
        >
          {isConnected && isBucketReady ? (
            <CheckCircle2 className="size-5 text-[color:var(--neon)] shrink-0 mt-0.5" />
          ) : isConnected ? (
            <AlertTriangle className="size-5 text-[color:var(--warning)] shrink-0 mt-0.5" />
          ) : (
            <CloudOff className="size-5 text-primary shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm mb-0.5">
              {isConnected && isBucketReady
                ? "Supabase Ready — Cloud Sync Active"
                : isConnected
                ? "Supabase DB Active — Storage Bucket Setup Needed"
                : "Running in Local Fallback Mode"}
            </div>
            <p className="sub-text text-muted-foreground leading-relaxed">
              {health?.message}
            </p>
          </div>
        </div>

        {/* Status items grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="glass-strong rounded-lg p-3 border border-border/40">
            <div className="text-[10px] text-muted-foreground uppercase font-mono mb-1">Configuration</div>
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              {isSupabaseConfigured ? (
                <>
                  <CheckCircle2 className="size-3.5 text-[color:var(--neon)]" />
                  <span>Configured in .env</span>
                </>
              ) : (
                <>
                  <Info className="size-3.5 text-muted-foreground" />
                  <span>Not configured</span>
                </>
              )}
            </div>
          </div>

          <div className="glass-strong rounded-lg p-3 border border-border/40">
            <div className="text-[10px] text-muted-foreground uppercase font-mono mb-1">Database Table</div>
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              {isTableReady ? (
                <>
                  <CheckCircle2 className="size-3.5 text-[color:var(--neon)]" />
                  <span>Table 'inspections' OK</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="size-3.5 text-[color:var(--warning)]" />
                  <span>Table missing / setup needed</span>
                </>
              )}
            </div>
          </div>

          <div className="glass-strong rounded-lg p-3 border border-border/40">
            <div className="text-[10px] text-muted-foreground uppercase font-mono mb-1">Storage Bucket</div>
            <div className="flex items-center gap-1.5 font-semibold text-foreground">
              {isBucketReady ? (
                <>
                  <CheckCircle2 className="size-3.5 text-[color:var(--neon)]" />
                  <span>Bucket 'wafer-inspections' OK</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="size-3.5 text-[color:var(--warning)]" />
                  <span>Bucket missing / setup needed</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Toggleable instructions & SQL snippet */}
        <div className="pt-2 border-t border-border/30">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1.5 text-[11px] font-mono text-primary hover:underline"
          >
            <HelpCircle className="size-3.5" />
            {showDetails ? "Hide Supabase Setup Guide & SQL Schema" : "How to Configure Supabase Cloud Storage & Database"}
          </button>

          {showDetails && (
            <div className="mt-3 space-y-3 p-3.5 rounded-lg bg-black/40 border border-border/50 text-[11px]">
              <div>
                <span className="font-semibold text-foreground block mb-1">1. Add environment variables to `.env`:</span>
                <pre className="p-2 rounded bg-black/60 font-mono text-[10px] text-[color:var(--neon)] overflow-x-auto">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...`}
                </pre>
              </div>

              <div>
                <span className="font-semibold text-foreground block mb-1">2. Create Storage Bucket in Supabase Dashboard:</span>
                <p className="text-muted-foreground leading-relaxed">
                  Go to <strong>Storage → Create Bucket</strong> named <code className="text-primary">wafer-inspections</code> and toggle <strong>Public Bucket</strong> ON.
                </p>
              </div>

              <div>
                <span className="font-semibold text-foreground block mb-1">3. Run SQL to create `inspections` table:</span>
                <pre className="p-2 rounded bg-black/60 font-mono text-[10px] text-muted-foreground overflow-x-auto max-h-36">
{`CREATE TABLE IF NOT EXISTS public.inspections (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  filename TEXT NOT NULL,
  original_url TEXT,
  annotated_url TEXT,
  defects_count INT DEFAULT 0,
  defects JSONB DEFAULT '[]'::jsonb,
  inference_time FLOAT DEFAULT 0,
  metrics JSONB DEFAULT '{}'::jsonb,
  process_node TEXT,
  layer_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
