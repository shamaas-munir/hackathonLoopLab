import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Need help" };

export default function NeedHelpPage() {
  return (
    <>
      <PageHeader
        title="Need help"
        description="Ask the admin to change your branch or date sheet."
      />
      <EmptyState title="Coming soon" description="This page is being built." />
    </>
  );
}
