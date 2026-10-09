import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Edit student" };

export default function EditStudentPage() {
  return (
    <>
      <PageHeader title="Edit student" />
      <EmptyState title="Coming soon" description="This page is being built." />
    </>
  );
}
