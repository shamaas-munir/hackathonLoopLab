import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Assignments" };

export default function AssignmentsPage() {
  return (
    <>
      <PageHeader
        title="Assignments"
        description="Courses assigned to each student."
      />
      <EmptyState title="Coming soon" description="This page is being built." />
    </>
  );
}
