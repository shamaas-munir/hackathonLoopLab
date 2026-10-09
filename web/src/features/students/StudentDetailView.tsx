"use client";

import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Mail, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StatusBadge, type Status } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { ManageCoursesDialog } from "@/features/assignments/ManageCoursesDialog";
import { ApiError, apiDelete, apiPost } from "@/lib/api";
import { formatDate, formatDateTime, formatDay, formatTimeRange } from "@/lib/format";
import {
  isAssignmentComplete,
  isDatesheetLocked,
  MAX_COURSES,
  studentsKey,
  useStudent,
  type StudentDetail,
} from "./api";
import { StudentAvatar } from "./StudentAvatar";
import { StudentStatusBadges } from "./StudentBadges";

const GENDER = { male: "Male", female: "Female", other: "Other" } as const;
const REQUEST_TYPE: Record<string, string> = {
  change_branch: "Change branch",
  change_datesheet: "Change date sheet",
};

export function StudentDetailView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const student = useStudent(id);

  if (student.isPending) return <PageSkeleton />;
  if (student.isError) {
    const notFound = student.error instanceof ApiError && student.error.status === 404;
    return (
      <ErrorState
        title={notFound ? "Student not found" : undefined}
        message={notFound ? "It may have been deleted." : undefined}
        onRetry={notFound ? undefined : () => void student.refetch()}
      />
    );
  }
  return <StudentProfile s={student.data} />;
}

function StudentProfile({ s }: { s: StudentDetail }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [managing, setManaging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resending, setResending] = useState(false);
  const count = s.assignments.length;
  const selections = [...s.selections].sort((a, b) => a.start_at.localeCompare(b.start_at));

  async function resendInvite() {
    setResending(true);
    try {
      await apiPost(`/admin/students/${s.id}/resend-invite/`);
      toast.success(`Setup email sent again to ${s.email}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not resend the invite.");
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Student details"
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/admin/students/${s.id}/edit`}>
                <Pencil aria-hidden />
                Edit
              </Link>
            </Button>
            {s.account_status === "invited" && (
              <LoadingButton variant="outline" loading={resending} onClick={() => void resendInvite()}>
                <Mail aria-hidden />
                Resend invite
              </LoadingButton>
            )}
            <Button variant="outline" className="text-danger hover:text-danger" onClick={() => setDeleting(true)}>
              <Trash2 aria-hidden />
              Delete
            </Button>
          </>
        }
      />

      <div className="space-y-4 md:space-y-6">
        <section className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm sm:flex-row sm:items-center md:p-6">
          <StudentAvatar name={s.full_name} photo={s.photo} className="size-20 text-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <h2 className="text-xl font-semibold break-words">{s.full_name}</h2>
              <p className="text-sm break-words text-muted-foreground">
                {s.registration_no} · {s.email}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <StatusBadge status={isAssignmentComplete(count) ? "complete" : "incomplete"} label={`Courses ${count}/${MAX_COURSES}`} />
              <StudentStatusBadges row={s} />
              {isDatesheetLocked(s) && <StatusBadge status="locked" />}
              <StatusBadge
                status={s.branch ? "active" : "pending"}
                label={s.branch ? `Branch: ${s.branch.name}` : "No branch yet"}
              />
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:gap-6 lg:grid-cols-3">
          <InfoCard
            title="Personal"
            items={[
              ["Phone", s.phone],
              ["CNIC / B-Form", s.cnic],
              ["Date of birth", formatDate(`${s.date_of_birth}T00:00:00`)],
              ["Gender", GENDER[s.gender]],
              ["Address", s.address],
            ]}
          />
          <InfoCard
            title="Parent / Guardian"
            items={[
              ["Name", s.guardian_name],
              ["CNIC", s.guardian_cnic],
              ["Occupation", s.guardian_occupation],
              ["Contact", s.guardian_contact],
              ["Emergency", s.emergency_contact],
            ]}
          />
          <InfoCard
            title="Academic"
            items={[
              ["Program", s.program_name],
              ["Semester", String(s.semester)],
              ["Session", s.session],
              ["Qualification", s.previous_qualification],
              ["Institute", s.previous_institute],
              ["Marks / CGPA", s.marks_or_cgpa],
            ]}
          />
        </div>

        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          <Card
            title={`Assigned courses (${count}/${MAX_COURSES})`}
            action={
              <Button variant="outline" size="sm" className="h-11 md:h-8" onClick={() => setManaging(true)}>
                <BookOpen aria-hidden />
                Manage
              </Button>
            }
          >
            {!isAssignmentComplete(count) && (
              <p className="mb-3 rounded-lg border border-warning/35 bg-warning/10 p-3 text-sm">
                Assignment incomplete: the student needs 4 to 6 courses before choosing a date sheet.
              </p>
            )}
            {count === 0 ? (
              <p className="text-sm text-muted-foreground">No courses assigned yet.</p>
            ) : (
              <ul className="divide-y">
                {s.assignments.map(({ id, course }) => (
                  <li key={id} className="flex items-start justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{course.code}</span>
                      <span className="block text-sm break-words text-muted-foreground">{course.title}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{course.credit_hours} cr</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Date sheet"
            action={<StatusBadge status={s.datesheet_saved_at ? "saved" : "not_saved"} />}
          >
            {selections.length === 0 ? (
              <p className="text-sm text-muted-foreground">The student has not saved a date sheet yet.</p>
            ) : (
              <ul className="divide-y">
                {selections.map((sel) => (
                  <li key={sel.id} className="grid gap-0.5 py-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-3">
                    <span className="min-w-0">
                      <span className="font-medium">{sel.course_code}</span>{" "}
                      <span className="break-words text-muted-foreground">{sel.course_title}</span>
                    </span>
                    <span className="text-muted-foreground sm:text-right">
                      {formatDay(sel.start_at)}, {formatDate(sel.start_at)}
                      <span className="block">{formatTimeRange(sel.start_at, sel.end_at)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {s.datesheet_saved_at && (
              <p className="mt-3 text-xs text-muted-foreground">
                Saved {formatDateTime(s.datesheet_saved_at)}
                {s.branch ? ` at ${s.branch.name}` : ""}
              </p>
            )}
          </Card>
        </div>

        <Card title="Requests">
          {s.requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No change requests.</p>
          ) : (
            <ul className="divide-y">
              {s.requests.map((r) => (
                <li key={r.id} className="space-y-1 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{REQUEST_TYPE[r.type] ?? r.type}</span>
                    <StatusBadge status={r.status as Status} />
                    <span className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</span>
                  </div>
                  <p className="break-words">{r.reason}</p>
                  {r.admin_remark && (
                    <p className="break-words text-muted-foreground">Admin remark: {r.admin_remark}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <ManageCoursesDialog studentId={managing ? s.id : null} onOpenChange={setManaging} />

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${s.full_name}?`}
        description="Their login, course assignments, date sheet and requests are deleted too. This cannot be undone."
        confirmText="Delete student"
        destructive
        onConfirm={async () => {
          await apiDelete(`/admin/students/${s.id}/`);
          await queryClient.invalidateQueries({ queryKey: studentsKey });
          toast.success("Student deleted");
          router.replace("/admin/students");
        }}
      />
    </>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card p-4 shadow-sm md:p-6">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        {action}
      </header>
      {children}
    </section>
  );
}

function InfoCard({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <Card title={title}>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        {items.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="text-right break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
