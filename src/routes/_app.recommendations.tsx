import { createFileRoute } from "@tanstack/react-router";
import { Panel, PageHeader, Badge } from "@/components/layout/AppShell";
import { AlertOctagon, Activity, ThermometerSun, FlaskConical, Eye } from "lucide-react";

export const Route = createFileRoute("/_app/recommendations")({
  head: () => ({ meta: [{ title: "Smart Recommendations — SDF" }] }),
  component: Recs,
});

const recs = [
  { icon: AlertOctagon, title: "Overlay Shift Correction", desc: "Overlay shift exceeding threshold. Recalibrate alignment system.", sev: "High", tone: "critical" as const },
  { icon: Activity, title: "Stage Vibration Check", desc: "Vibration levels may be causing alignment errors. Inspect stage.", sev: "Medium", tone: "warning" as const },
  { icon: ThermometerSun, title: "Temperature Stabilization", desc: "Temperature variation detected. Stabilize within ±0.5°C.", sev: "Medium", tone: "warning" as const },
  { icon: FlaskConical, title: "Oxidation Process Optimization", desc: "Oxidation inconsistency high. Review oxidation process parameters.", sev: "Low", tone: "cyan" as const },
  { icon: Eye, title: "Lens Cleanliness Check", desc: "Optical path may be affecting alignment. Clean inspection lens.", sev: "Low", tone: "cyan" as const },
];

function Recs() {
  return (
    <>
      <PageHeader title="Smart Recommendation Engine" crumbs={["Home", "Recommendations"]} />
      <Panel title="AI-Generated Process Recommendations" subtitle="Powered by CNN-Overlay v2.3.1 · updated 2 min ago">
        <div className="divide-y divide-border/60 -m-4">
          {recs.map((r) => {
            const Icon = r.icon;
            const color = r.tone === "critical" ? "var(--critical)" : r.tone === "warning" ? "var(--warning)" : "var(--cyan)";
            return (
              <div key={r.title} className="px-4 py-4 grid grid-cols-12 items-center gap-4 hover:bg-primary/5">
                <div className="col-span-1">
                  <div className="size-10 rounded-md grid place-items-center" style={{ background: `color-mix(in oklab, ${color} 12%, transparent)`, color }}>
                    <Icon className="size-5" />
                  </div>
                </div>
                <div className="col-span-8">
                  <div className="font-display tracking-wide">{r.title}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{r.desc}</div>
                </div>
                <div className="col-span-2"><Badge label={r.sev} tone={r.tone} pulse={r.tone === "critical"} /></div>
                <div className="col-span-1 text-right">
                  <button className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] font-display tracking-wider">VIEW</button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </>
  );
}
