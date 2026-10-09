"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { components } from "@/api/schema";

type Dashboard = components["schemas"]["Dashboard"];

const AXIS = { fontSize: 12, fill: "var(--muted-foreground)" };
const TOOLTIP = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--popover-foreground)",
    fontSize: 13,
  },
  cursor: { fill: "var(--muted)" },
};
const STATUS_COLORS: Record<string, string> = {
  pending: "var(--warning)",
  approved: "var(--success)",
  rejected: "var(--danger)",
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-xl border bg-card p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      <div className="h-64">{children}</div>
    </section>
  );
}

export default function DashboardCharts({ data }: { data: Dashboard }) {
  const donut = [
    { name: "Saved", value: data.datesheets.saved, color: "var(--success)" },
    { name: "Not saved", value: data.datesheets.not_saved, color: "var(--chart-2)" },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ChartCard title="Date sheets saved vs not saved">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={donut} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" stroke="var(--card)">
              {donut.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip {...TOOLTIP} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Students per branch">
        <ResponsiveContainer>
          <BarChart data={data.students_per_branch} margin={{ left: -20, right: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="code" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
            <Tooltip {...TOOLTIP} labelFormatter={(code) => data.students_per_branch.find((b) => b.code === code)?.name ?? code} />
            <Bar dataKey="students_count" name="Students" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Requests by status">
        <ResponsiveContainer>
          <BarChart data={data.requests_by_status} margin={{ left: -20, right: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
            <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
            <Tooltip {...TOOLTIP} />
            <Bar dataKey="count" name="Requests" radius={[6, 6, 0, 0]}>
              {data.requests_by_status.map((r) => (
                <Cell key={r.status} fill={STATUS_COLORS[r.status] ?? "var(--chart-1)"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
