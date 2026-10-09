import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Student details" };

export default function StudentDetailsPage() {
  return (
    <>
      <PageHeader title="Student details" />
      <EmptyState title="Coming soon" description="This page is being built." />
    </>
  );
}
