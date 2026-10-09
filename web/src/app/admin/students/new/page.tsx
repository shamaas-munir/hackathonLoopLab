import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "New student" };

export default function NewStudentPage() {
  return (
    <>
      <PageHeader
        title="New student"
        description="Create a student account and send a setup email."
      />
      <EmptyState title="Coming soon" description="This page is being built." />
    </>
  );
}
