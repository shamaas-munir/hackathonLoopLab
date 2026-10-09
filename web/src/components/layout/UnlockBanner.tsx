"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/session";

/** Tells a student when an approved request has unlocked their branch or date sheet. */
export function UnlockBanner() {
  const pathname = usePathname();
  const flow = useMe().data?.flow;
  if (!flow) return null;

  const banner = flow.branch_unlocked
    ? {
        text: "Your branch change was approved. Select your new branch.",
        href: "/student/select-branch",
        cta: "Select branch",
      }
    : flow.datesheet_unlocked && flow.has_saved_datesheet
      ? {
          text: "Your date sheet change was approved. You can now update your exam slots.",
          href: "/student/dashboard",
          cta: "Edit date sheet",
        }
      : null;
  if (!banner || pathname === banner.href) return null;

  return (
    <div
      role="status"
      className="no-print mb-6 flex flex-col gap-3 rounded-xl border border-success/30 bg-success/10 p-4 sm:flex-row sm:items-center"
    >
      <CircleCheck className="hidden size-5 shrink-0 text-success sm:block" aria-hidden />
      <p className="flex-1 text-sm font-medium">{banner.text}</p>
      <Button asChild>
        <Link href={banner.href}>{banner.cta}</Link>
      </Button>
    </div>
  );
}
