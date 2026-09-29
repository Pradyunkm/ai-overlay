import { Area, AreaChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";

const grid = "oklch(0.50 0.06 240 / 0.15)";
const axis = "oklch(0.70 0.03 240 / 0.5)";

const tooltipStyle = {
  background: "oklch(0.18 0.04 260 / 0.95)",
  border: "1px solid oklch(0.78 0.18 200 / 0.3)",
  borderRadius: 6,
  fontSize: 11,
  color: "white",
};

export function SparkArea({ data, color = "var(--cyan)", height = 80 }: { data: number[]; color?: string; height?: number }) {
  const d = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={d} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
        <defs>
          <linearGradient id={`g${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`color-mix(in oklab, ${color} 70%, transparent)`} />
            <stop offset="100%" stopColor={`color-mix(in oklab, ${color} 0%, transparent)`} />
          </linearGradient>
        </defs>
        <Area dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#g${color})`} type="monotone" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function LiveLine({ data, color = "var(--cyan)", height = 200 }: { data: { t: string; v: number }[]; color?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="t" stroke={axis} tick={{ fontSize: 10 }} tickLine={false} />
        <YAxis stroke={axis} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, innerRadius = 28, outerRadius = 38 }: { data: { name: string; value: number; color: string }[]; innerRadius?: number; outerRadius?: number }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data} dataKey="value" innerRadius={innerRadius} outerRadius={outerRadius} paddingAngle={2} stroke="none">
          {data.map((d, i) => <Cell key={i} fill={d.color} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function ScatterPlot({ data }: { data: { x: number; y: number; g: number }[] }) {
  const colors = ["var(--cyan)", "var(--critical)", "var(--neon)"];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <ScatterChart margin={{ left: -10, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid stroke={grid} />
        <XAxis type="number" dataKey="x" stroke={axis} tick={{ fontSize: 10 }} />
        <YAxis type="number" dataKey="y" stroke={axis} tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "var(--cyan)", strokeDasharray: "3 3" }} />
        <Scatter data={data}>
          {data.map((d, i) => <Cell key={i} fill={colors[d.g]} />)}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function gen(n: number, base = 50, amp = 30, drift = 0) {
  return Array.from({ length: n }, (_, i) => Math.round(base + Math.sin(i / 2) * amp + (Math.random() - 0.5) * 8 + i * drift));
}
export function genTime(n: number, base = 50, amp = 30) {
  const start = 10 * 60 + 40;
  return Array.from({ length: n }, (_, i) => {
    const m = start + i * 5;
    const t = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    return { t, v: Math.round(base + Math.sin(i / 1.5) * amp + (Math.random() - 0.5) * 10) };
  });
}
