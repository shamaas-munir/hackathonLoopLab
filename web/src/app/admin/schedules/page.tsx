import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Exam slots" };

export default function ExamSlotsPage() {
  return (
    <>
      <PageHeader
        title="Exam slots"
        description="Dates and times students can choose for each course."
      />
      <EmptyState title="Coming soon" description="This page is being built." />
    </>
  );
}
