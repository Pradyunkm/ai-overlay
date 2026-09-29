import { createFileRoute } from "@tanstack/react-router";
import { Panel, PageHeader, Badge } from "@/components/layout/AppShell";
import { FileText, Download, RefreshCw, Plus } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { fetchReportsList, generateReport, getReportDownloadUrl, type ReportItem } from "@/lib/api/backend";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Reports — SDF" }] }),
  component: Reports,
});

const FALLBACK_REPORTS: ReportItem[] = [
  { id: "RPT-2451", db_id: 0, title: "Daily Inspection Summary",    inspection_id: 0, pdf_url: "", size_kb: 4300,  size_str: "4.2 MB", date: "2026-06-03", status: "Ready" },
  { id: "RPT-2450", db_id: 0, title: "Overlay Drift Weekly Report", inspection_id: 0, pdf_url: "", size_kb: 13000, size_str: "12.7 MB", date: "2026-06-02", status: "Ready" },
  { id: "RPT-2449", db_id: 0, title: "Yield Forecast — Q2",         inspection_id: 0, pdf_url: "", size_kb: 8300,  size_str: "8.1 MB", date: "2026-06-01", status: "Ready" },
];

function Reports() {
  const [reports,    setReports]    = useState<ReportItem[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [generating, setGenerating] = useState(false);

  const reload = useCallback(() => {
    setLoading(true);
    fetchReportsList()
      .then((d) => setReports(d.reports.length ? d.reports : FALLBACK_REPORTS))
      .catch(() => setReports(FALLBACK_REPORTS))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateReport();
      toast.success(`Report generated: ${result.title}`, { description: `${result.size_kb} KB · PDF ready` });
      reload();
    } catch (err: any) {
      const msg = err?.message ?? "Generation failed";
      if (msg.includes("404")) {
        toast.error("No inspections found", { description: "Upload and analyze a wafer image first." });
      } else {
        toast.error("Report generation failed", { description: msg });
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = (r: ReportItem) => {
    if (!r.pdf_url) {
      toast.error("No PDF available", { description: "Generate this report first." });
      return;
    }
    const url = getReportDownloadUrl(r.pdf_url);
    const a   = document.createElement("a");
    a.href    = url;
    a.target  = "_blank";
    a.rel     = "noopener noreferrer";
    a.download = r.title + ".pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const displayReports = reports.length ? reports : FALLBACK_REPORTS;

  return (
    <>
      <PageHeader title="Reports" crumbs={["Home", "Reports"]} />
      <Panel
        title="Generated Reports"
        subtitle="Exportable inspection & analytics artifacts"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={reload}
              disabled={loading}
              title="Refresh list"
              className="size-8 rounded-md glass grid place-items-center text-muted-foreground hover:text-primary hover:glow-cyan transition disabled:opacity-40"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-display tracking-wider transition hover:opacity-90 hover:glow-cyan disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, var(--primary), var(--neon))", color: "oklch(0.12 0.03 260)" }}
            >
              {generating
                ? <RefreshCw className="size-3 animate-spin" />
                : <Plus className="size-3" />}
              {generating ? "GENERATING…" : "GENERATE REPORT"}
            </button>
          </div>
        }
      >
        <div className="divide-y divide-border/60 -m-4">
          {displayReports.map((r) => {
            const tone: "neon" | "warning" = r.status === "Ready" ? "neon" : "warning";
            return (
              <div key={r.id} className="px-4 py-3.5 grid grid-cols-12 items-center gap-3 hover:bg-primary/5 transition">
                <div className="col-span-1"><FileText className="size-5 text-primary" /></div>
                <div className="col-span-2 font-mono text-[12px] text-muted-foreground">{r.id}</div>
                <div className="col-span-5 font-display tracking-wide text-[13px]">{r.title}</div>
                <div className="col-span-2 text-[11px] text-muted-foreground">{r.date} · {r.size_str || `${r.size_kb} KB`}</div>
                <div className="col-span-1"><Badge label={r.status} tone={tone} pulse={tone === "warning"} /></div>
                <div className="col-span-1 text-right">
                  <button
                    onClick={() => handleDownload(r)}
                    title={r.pdf_url ? "Download PDF" : "No PDF yet"}
                    className="size-8 rounded-md glass grid place-items-center text-primary hover:glow-cyan transition"
                  >
                    <Download className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {displayReports.length === 0 && !loading && (
            <div className="px-4 py-8 text-center text-muted-foreground text-[12px]">
              No reports yet — click <strong className="text-foreground">Generate Report</strong> above.
            </div>
          )}
        </div>
      </Panel>
    </>
  );
}
