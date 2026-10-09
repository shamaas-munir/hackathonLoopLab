import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Select branch" };

export default function SelectBranchPage() {
  return (
    <>
      <PageHeader
        title="Select your branch"
        description="Choose the campus where you will sit your exams."
      />
      <EmptyState title="Coming soon" description="This page is being built." />
    </>
  );
}
