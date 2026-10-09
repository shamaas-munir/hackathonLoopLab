import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/PageHeader";
import { AssignmentsTable } from "@/features/assignments/AssignmentsTable";

export const metadata: Metadata = { title: "Assignments" };

export default function AssignmentsPage() {
  return (
    <>
      <PageHeader
        title="Course assignments"
        description="Every student needs 4 to 6 courses before choosing a date sheet."
      />
      <AssignmentsTable />
    </>
  );
}
