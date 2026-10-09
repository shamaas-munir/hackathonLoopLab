"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { Me } from "@/lib/session";
import { useMe } from "@/lib/session";

type Flow = NonNullable<Me["flow"]>;
type StudentPage = "select-branch" | "dashboard" | "datesheet" | "help";

const SELECT_BRANCH = "/student/select-branch";

/** Where a student on `page` must go instead, or null when the page is allowed (flow from /auth/me/). */
function redirectFor(page: StudentPage, flow: Flow): string | null {
  switch (page) {
    case "select-branch":
      return flow.needs_branch_selection ? null : flow.home_route;
    case "dashboard":
      return flow.needs_branch_selection ? SELECT_BRANCH : null;
    case "datesheet":
      if (flow.needs_branch_selection) return SELECT_BRANCH;
      return flow.has_saved_datesheet ? null : "/student/dashboard";
    case "help":
      return null;
  }
}

export function useStudentGuard(page: StudentPage) {
  const router = useRouter();
  const me = useMe();
  const flow = me.data?.flow ?? undefined;
  const target = flow ? redirectFor(page, flow) : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [router, target]);

  return { flow, allowed: Boolean(flow) && !target, error: me.error, retry: me.refetch };
}
