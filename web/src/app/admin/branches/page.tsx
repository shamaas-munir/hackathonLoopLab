import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Branches" };

export default function BranchesPage() {
  return (
    <>
      <PageHeader
        title="Branches"
        description="Campuses where students sit their exams."
      />
      <EmptyState title="Coming soon" description="This page is being built." />
    </>
  );
}
