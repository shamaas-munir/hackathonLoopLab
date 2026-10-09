import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Audit log" };

export default function AuditLogPage() {
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Every change made by an admin."
      />
      <EmptyState title="Coming soon" description="This page is being built." />
    </>
  );
}
