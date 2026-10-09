import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Students" };

export default function StudentsPage() {
  return (
    <>
      <PageHeader
        title="Students"
        description="Student accounts, profiles and progress."
      />
      <EmptyState title="Coming soon" description="This page is being built." />
    </>
  );
}
