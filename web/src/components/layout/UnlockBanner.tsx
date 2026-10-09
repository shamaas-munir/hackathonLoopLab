"use client";

import { CircleCheck, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/session";

const STORAGE_KEY = "examslot.dismissed-unlock-banners";

function readDismissed(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Tells a student when an approved request has unlocked their branch or date sheet. */
export function UnlockBanner() {
  const pathname = usePathname();
  const flow = useMe().data?.flow;
  const [dismissed, setDismissed] = useState(readDismissed);
  if (!flow) return null;

  const banner = flow.branch_unlocked
    ? {
        text: "Your branch change was approved. Select your new branch.",
        key: "branch",
        href: "/student/select-branch",
        cta: "Select branch",
      }
    : flow.datesheet_unlocked && flow.has_saved_datesheet
      ? {
          text: "Your date sheet change was approved. You can now update your exam slots.",
          key: "datesheet",
          href: "/student/dashboard",
          cta: "Edit date sheet",
        }
      : null;
  if (!banner || pathname === banner.href || dismissed.includes(banner.key)) return null;

  const dismiss = () => {
    const next = [...dismissed, banner.key];
    setDismissed(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage unavailable (private mode): the banner stays hidden until reload.
    }
  };

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
      <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss" className="self-end sm:self-auto">
        <X aria-hidden />
      </Button>
    </div>
  );
}
