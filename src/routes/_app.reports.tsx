import { createFileRoute } from "@tanstack/react-router";
import { Panel, PageHeader, Badge } from "@/components/layout/AppShell";
import { FileText, Download } from "lucide-react";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Reports — SDF" }] }),
  component: Reports,
});

const reports = [
  { id: "RPT-2451", title: "Daily Inspection Summary", date: "2026-06-03", size: "4.2MB", status: "Ready", tone: "neon" as const },
  { id: "RPT-2450", title: "Overlay Drift Weekly Report", date: "2026-06-02", size: "12.7MB", status: "Ready", tone: "neon" as const },
  { id: "RPT-2449", title: "Yield Forecast — Q2", date: "2026-06-01", size: "8.1MB", status: "Ready", tone: "neon" as const },
  { id: "RPT-2448", title: "Predictive Failure Analysis", date: "2026-05-31", size: "5.6MB", status: "Generating", tone: "warning" as const },
  { id: "RPT-2447", title: "Process Drift Audit", date: "2026-05-30", size: "9.3MB", status: "Ready", tone: "neon" as const },
];

function Reports() {
  return (
    <>
      <PageHeader title="Reports" crumbs={["Home", "Reports"]} />
      <Panel title="Generated Reports" subtitle="Exportable inspection & analytics artifacts">
        <div className="divide-y divide-border/60 -m-4">
          {reports.map((r) => (
            <div key={r.id} className="px-4 py-3.5 grid grid-cols-12 items-center gap-3 hover:bg-primary/5">
              <div className="col-span-1"><FileText className="size-5 text-primary" /></div>
              <div className="col-span-2 font-mono text-[12px] text-muted-foreground">{r.id}</div>
              <div className="col-span-5 font-display tracking-wide text-[13px]">{r.title}</div>
              <div className="col-span-2 text-[11px] text-muted-foreground">{r.date} · {r.size}</div>
              <div className="col-span-1"><Badge label={r.status} tone={r.tone} pulse={r.tone === "warning"} /></div>
              <div className="col-span-1 text-right">
                <button className="size-8 rounded-md glass grid place-items-center text-primary hover:glow-cyan"><Download className="size-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
