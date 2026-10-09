import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/PageHeader";
import { BranchesView } from "@/features/branches/BranchesView";

export const metadata: Metadata = { title: "Branches" };

export default function BranchesPage() {
  return (
    <>
      <PageHeader title="Branches" description="Campuses where students sit their exams." />
      <BranchesView />
    </>
  );
}
