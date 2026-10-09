import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <PageHeader
        title="Reset your password"
        description="We will email you a link to set a new password."
      />
      <EmptyState title="Coming soon" description="This page is being built." />
    </>
  );
}
