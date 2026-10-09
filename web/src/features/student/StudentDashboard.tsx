"use client";

import { Lock, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { StudentStepper } from "@/components/layout/StudentStepper";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import { useProfile } from "./api";
import { DatesheetDesigner } from "./DatesheetDesigner";
import { ProfileOverview } from "./ProfileOverview";
import { useStudentGuard } from "./useStudentGuard";

const MIN_COURSES = 4;

export function StudentDashboard() {
  const guard = useStudentGuard("dashboard");
  const profile = useProfile();

  if (guard.error) return <ErrorState onRetry={() => void guard.retry()} />;
  if (!guard.allowed || profile.isPending) return <PageSkeleton />;
  if (profile.isError) return <ErrorState onRetry={() => void profile.refetch()} />;

  const flow = profile.data.flow;
  return (
    <>
      <StudentStepper current={flow.has_saved_datesheet && !flow.can_edit_datesheet ? 3 : 2} />
      <PageHeader title="My date sheet" description="Check your details and schedule your exams." />
      <ProfileOverview profile={profile.data} />

      {!flow.assignment_complete ? (
        <div
          role="alert"
          className="flex gap-3 rounded-xl border border-warning/35 bg-warning/10 p-4 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <p>
            Your course assignment is incomplete ({flow.assignment_count} of minimum {MIN_COURSES}).
            Please contact the administration.
          </p>
        </div>
      ) : flow.can_edit_datesheet ? (
        <DatesheetDesigner unlocked={flow.datesheet_unlocked && flow.has_saved_datesheet} />
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary-soft p-4 text-sm sm:flex-row sm:items-center">
          <Lock className="hidden size-5 shrink-0 text-primary sm:block" aria-hidden />
          <p className="flex-1">
            Your date sheet is saved and locked. To change it, raise a request from Need Help.
          </p>
          <Button asChild>
            <Link href="/student/datesheet">View date sheet</Link>
          </Button>
        </div>
      )}
    </>
  );
}
