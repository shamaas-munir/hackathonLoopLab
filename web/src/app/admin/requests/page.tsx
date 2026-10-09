import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Requests" };

export default function RequestsPage() {
  return (
    <>
      <PageHeader
        title="Requests"
        description="Branch and date sheet change requests from students."
      />
      <EmptyState title="Coming soon" description="This page is being built." />
    </>
  );
}
