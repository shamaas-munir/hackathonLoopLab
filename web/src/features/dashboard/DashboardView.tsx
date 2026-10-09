"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Building2,
  CalendarClock,
  CalendarCheck,
  ChevronRight,
  Inbox,
  TriangleAlert,
  Users,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { components } from "@/api/schema";
import { ErrorState } from "@/components/shared/ErrorState";
import { Stat } from "@/components/shared/Stat";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, apiGet } from "@/lib/api";

type Dashboard = components["schemas"]["Dashboard"];

function ChartsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-[316px] rounded-xl" />
      ))}
    </div>
  );
}

// Recharts is heavy: load it only on this page, after the numbers.
const DashboardCharts = dynamic(() => import("./DashboardCharts"), { ssr: false, loading: ChartsSkeleton });

export function DashboardView() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<Dashboard>("/admin/dashboard/"),
  });

  if (isError) {
    return <ErrorState message={error instanceof ApiError ? error.message : undefined} onRetry={() => void refetch()} />;
  }

  const loading = isPending;
  const attention = [
    {
      href: "/admin/requests?status=pending",
      icon: Inbox,
      label: "Pending requests",
      count: data?.pending_requests ?? 0,
    },
    {
      href: "/admin/students?assignment=incomplete",
      icon: TriangleAlert,
      label: "Students with fewer than 4 courses",
      count: data?.assignment_incomplete ?? 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Stat icon={Users} label="Students" value={data?.totals.students} loading={loading} />
        <Stat
          icon={CalendarCheck}
          label="Date sheets saved"
          value={data?.datesheets.saved}
          hint={data && `${data.datesheets.not_saved} not saved`}
          loading={loading}
        />
        <Stat icon={Building2} label="Active branches" value={data?.totals.active_branches} loading={loading} />
        <Stat icon={BookOpen} label="Active courses" value={data?.totals.active_courses} loading={loading} />
        <Stat icon={CalendarClock} label="Upcoming slots" value={data?.totals.upcoming_slots} loading={loading} />
        <Stat icon={Inbox} label="Pending requests" value={data?.pending_requests} loading={loading} />
      </div>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-medium">Needs attention</h2>
        <ul className="divide-y">
          {attention.map(({ href, icon: Icon, label, count }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex min-h-11 items-center gap-3 rounded-md px-1 py-2 text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Icon className="size-4 shrink-0 text-warning" aria-hidden />
                <span className="min-w-0 flex-1">{label}</span>
                {loading ? (
                  <Skeleton className="h-5 w-6" />
                ) : (
                  <span className="font-semibold tabular-nums">{count}</span>
                )}
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {data ? <DashboardCharts data={data} /> : <ChartsSkeleton />}
    </div>
  );
}
