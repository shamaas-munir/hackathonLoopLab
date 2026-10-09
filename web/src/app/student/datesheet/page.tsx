import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Date sheet" };

export default function DateSheetPage() {
  return (
    <>
      <PageHeader
        title="Date sheet"
        description="Your saved exam schedule."
      />
      <EmptyState title="Coming soon" description="This page is being built." />
    </>
  );
}
