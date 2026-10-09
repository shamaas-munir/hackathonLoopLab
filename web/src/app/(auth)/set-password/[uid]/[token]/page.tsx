import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCardSkeleton } from "@/features/auth/AuthCard";
import { SetPasswordFlow } from "@/features/auth/SetPasswordFlow";

export const metadata: Metadata = { title: "Set password", referrer: "no-referrer" };

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <SetPasswordFlow />
    </Suspense>
  );
}
