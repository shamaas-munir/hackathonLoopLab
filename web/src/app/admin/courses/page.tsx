import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Courses" };

export default function CoursesPage() {
  return (
    <>
      <PageHeader
        title="Courses"
        description="Courses that can be assigned and scheduled."
      />
      <EmptyState title="Coming soon" description="This page is being built." />
    </>
  );
}
