import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "My date sheet" };

export default function MyDateSheetPage() {
  return (
    <>
      <PageHeader
        title="My date sheet"
        description="Pick a slot for each of your courses."
      />
      <EmptyState title="Coming soon" description="This page is being built." />
    </>
  );
}
