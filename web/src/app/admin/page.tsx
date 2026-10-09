import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/PageHeader";
import { DashboardView } from "@/features/dashboard/DashboardView";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="An overview of students, date sheets and requests." />
      <DashboardView />
    </>
  );
}
