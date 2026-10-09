import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/PageHeader";
import { AuditLogView } from "@/features/audit/AuditLogView";

export const metadata: Metadata = { title: "Audit log" };

export default function AuditLogPage() {
  return (
    <>
      <PageHeader title="Audit log" description="Every change made by an admin, newest first." />
      <AuditLogView />
    </>
  );
}
