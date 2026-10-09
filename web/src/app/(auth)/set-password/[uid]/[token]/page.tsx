import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Set password" };

export default function SetPasswordPage() {
  return (
    <>
      <PageHeader
        title="Set your password"
        description="Choose a password for your account."
      />
      <EmptyState title="Coming soon" description="This page is being built." />
    </>
  );
}
