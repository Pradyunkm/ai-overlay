import { createFileRoute } from "@tanstack/react-router";
import { Panel, PageHeader, Badge } from "@/components/layout/AppShell";
import { LiveLine, genTime } from "@/components/viz/Charts";

export const Route = createFileRoute("/_app/predictive")({
  head: () => ({ meta: [{ title: "Predictive Analytics — SDF" }] }),
  component: Predictive,
});

function Predictive() {
  const risk = 18.3;
  const angle = -90 + (risk / 100) * 180;
  return (
    <>
      <PageHeader title="Predictive Analytics" crumbs={["Home", "Predictive Analytics"]} />
      <div className="grid grid-cols-12 gap-4">
        <Panel title="Predictive Failure Risk" className="col-span-12 lg:col-span-5">
          <div className="relative max-w-[360px] mx-auto">
            <svg viewBox="0 0 300 180" className="w-full">
              <defs>
                <linearGradient id="gauge" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="var(--neon)" />
                  <stop offset="50%" stopColor="var(--warning)" />
                  <stop offset="100%" stopColor="var(--critical)" />
                </linearGradient>
              </defs>
              <path d="M 30 150 A 120 120 0 0 1 270 150" fill="none" stroke="url(#gauge)" strokeWidth="18" strokeLinecap="round" />
              <path d="M 30 150 A 120 120 0 0 1 270 150" fill="none" stroke="oklch(0.18 0.04 260 / 0.6)" strokeWidth="22" strokeDasharray="2 8" />
              <g transform={`translate(150 150) rotate(${angle})`}>
                <line x1="0" y1="0" x2="0" y2="-110" stroke="oklch(0.95 0.02 240)" strokeWidth="3" />
                <circle r="8" fill="var(--cyan)" />
              </g>
              <text x="30" y="170" fill="oklch(0.7 0.03 240)" fontSize="10">0%</text>
              <text x="260" y="170" fill="oklch(0.7 0.03 240)" fontSize="10">100%</text>
            </svg>
            <div className="text-center -mt-6">
              <div className="text-4xl font-display text-[color:var(--warning)]">{risk}%</div>
              <Badge label="Medium Risk" tone="warning" pulse />
            </div>
          </div>
        </Panel>
        <Panel title="Failure Risk Trend" className="col-span-12 lg:col-span-7">
          <LiveLine data={genTime(20, 20, 10)} color="var(--warning)" height={260} />
          <div className="mt-3 text-[11px] text-muted-foreground">
            AI forecasts a <span className="text-[color:var(--warning)]">22.4%</span> failure risk in the next 24h based on current drift trajectory.
          </div>
        </Panel>
      </div>
    </>
  );
}
