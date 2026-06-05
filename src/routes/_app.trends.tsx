import { createFileRoute } from "@tanstack/react-router";
import { Panel, PageHeader } from "@/components/layout/AppShell";
import { LiveLine, genTime } from "@/components/viz/Charts";

export const Route = createFileRoute("/_app/trends")({
  head: () => ({ meta: [{ title: "Trend Analysis — SDF" }] }),
  component: Trends,
});

function Trends() {
  return (
    <>
      <PageHeader title="Trend Analysis" crumbs={["Home", "Trend Analysis"]} />
      <div className="grid grid-cols-12 gap-4">
        <Panel title="Defect Rate · 7-day" className="col-span-12 lg:col-span-6">
          <LiveLine data={genTime(20, 60, 20)} color="var(--cyan)" height={260} />
        </Panel>
        <Panel title="Yield Trend · 7-day" className="col-span-12 lg:col-span-6">
          <LiveLine data={genTime(20, 92, 3)} color="var(--neon)" height={260} />
        </Panel>
        <Panel title="Overlay Shift Drift" className="col-span-12 lg:col-span-6">
          <LiveLine data={genTime(20, 4, 1)} color="var(--violet)" height={220} />
        </Panel>
        <Panel title="Inference Latency" className="col-span-12 lg:col-span-6">
          <LiveLine data={genTime(20, 0.8, 0.2)} color="var(--warning)" height={220} />
        </Panel>
      </div>
    </>
  );
}
