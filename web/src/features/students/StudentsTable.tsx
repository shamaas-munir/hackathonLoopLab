"use client";

import { BookOpen, Eye, Mail, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable, useInvalidateList, type DataTableColumn } from "@/components/data-table/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { ManageCoursesDialog } from "@/features/assignments/ManageCoursesDialog";
import { apiDelete, apiPost } from "@/lib/api";
import { programsKey, studentsKey, useLookup, type Program, type StudentRow } from "./api";
import { CourseCount, StudentStatusBadges } from "./StudentBadges";
import { StudentAvatar } from "./StudentAvatar";

type BranchOption = { id: string; name: string };

const columns: DataTableColumn<StudentRow>[] = [
  {
    id: "student",
    header: "Student",
    sortField: "full_name",
    cell: (s) => (
      <Link href={`/admin/students/${s.id}`} className="flex min-w-0 items-center gap-3 hover:underline">
        <StudentAvatar name={s.full_name} photo={s.photo} />
        <span className="min-w-0">
          <span className="block truncate font-medium">{s.full_name}</span>
          <span className="block truncate text-xs text-muted-foreground">{s.email}</span>
        </span>
      </Link>
    ),
  },
  { id: "reg", header: "Reg no.", sortField: "registration_no", cell: (s) => s.registration_no },
  {
    id: "program",
    header: "Program",
    hideBelow: "lg",
    cell: (s) => (
      <span>
        {s.program_name}
        <span className="block text-xs text-muted-foreground">Semester {s.semester}</span>
      </span>
    ),
  },
  { id: "branch", header: "Branch", hideBelow: "lg", cell: (s) => s.branch_name ?? "Not selected" },
  { id: "courses", header: "Courses", cell: (s) => <CourseCount count={s.assignment_count} /> },
  {
    id: "status",
    header: "Status",
    cell: (s) => (
      <span className="flex flex-wrap gap-1">
        <StudentStatusBadges row={s} />
      </span>
    ),
  },
];

function MobileCard({ s }: { s: StudentRow }) {
  return (
    <div className="space-y-3">
      <Link href={`/admin/students/${s.id}`} className="flex min-w-0 items-center gap-3">
        <StudentAvatar name={s.full_name} photo={s.photo} />
        <span className="min-w-0">
          <span className="block font-medium break-words">{s.full_name}</span>
          <span className="block text-xs break-all text-muted-foreground">{s.email}</span>
        </span>
      </Link>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Reg no.</dt>
        <dd className="text-right break-words">{s.registration_no}</dd>
        <dt className="text-muted-foreground">Program</dt>
        <dd className="text-right break-words">
          {s.program_name}, sem {s.semester}
        </dd>
        <dt className="text-muted-foreground">Branch</dt>
        <dd className="text-right break-words">{s.branch_name ?? "Not selected"}</dd>
        <dt className="text-muted-foreground">Courses</dt>
        <dd className="text-right">
          <CourseCount count={s.assignment_count} />
        </dd>
      </dl>
      <div className="flex flex-wrap gap-1">
        <StudentStatusBadges row={s} />
      </div>
    </div>
  );
}

export function StudentsTable() {
  const router = useRouter();
  const refresh = useInvalidateList(studentsKey);
  const programs = useLookup<Program>(programsKey, "/admin/programs/");
  const branches = useLookup<BranchOption>(["branches"], "/admin/branches/");
  const [deleting, setDeleting] = useState<StudentRow | null>(null);
  const [managing, setManaging] = useState<string | null>(null);

  async function resendInvite(s: StudentRow) {
    try {
      await apiPost(`/admin/students/${s.id}/resend-invite/`);
      toast.success(`Setup email sent again to ${s.email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend the invite.");
    }
  }

  return (
    <>
      <DataTable<StudentRow>
        queryKey={studentsKey}
        endpoint="/admin/students/"
        columns={columns}
        mobileCard={(s) => <MobileCard s={s} />}
        searchPlaceholder="Search name, reg no, email or CNIC"
        emptyText="No students found"
        defaultOrdering="full_name"
        filters={[
          {
            id: "program",
            label: "Programs",
            options: (programs.data ?? []).map((p) => ({ value: p.id, label: p.name })),
          },
          {
            id: "branch",
            label: "Branches",
            options: (branches.data ?? []).map((b) => ({ value: b.id, label: b.name })),
          },
          {
            id: "assignment",
            label: "Assignments",
            options: [
              { value: "complete", label: "Complete (4 to 6)" },
              { value: "incomplete", label: "Incomplete" },
            ],
          },
          {
            id: "datesheet",
            label: "Date sheets",
            options: [
              { value: "saved", label: "Saved" },
              { value: "not_saved", label: "Not saved" },
            ],
          },
          {
            id: "account",
            label: "Accounts",
            options: [
              { value: "active", label: "Active" },
              { value: "invited", label: "Invite pending" },
            ],
          },
        ]}
        toolbarActions={
          <Button asChild>
            <Link href="/admin/students/new">
              <Plus aria-hidden />
              Add student
            </Link>
          </Button>
        }
        rowActions={(s) => [
          { label: "View", icon: Eye, onSelect: () => router.push(`/admin/students/${s.id}`) },
          { label: "Edit", icon: Pencil, onSelect: () => router.push(`/admin/students/${s.id}/edit`) },
          { label: "Manage courses", icon: BookOpen, onSelect: () => setManaging(s.id) },
          {
            label: "Resend invite",
            icon: Mail,
            onSelect: () => void resendInvite(s),
            disabled: s.account_status !== "invited",
          },
          { label: "Delete", icon: Trash2, destructive: true, onSelect: () => setDeleting(s) },
        ]}
      />

      <ManageCoursesDialog studentId={managing} onOpenChange={(open) => !open && setManaging(null)} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.full_name ?? "student"}?`}
        description="Their login, course assignments, date sheet and requests are deleted too. This cannot be undone."
        confirmText="Delete student"
        destructive
        onConfirm={async () => {
          await apiDelete(`/admin/students/${deleting!.id}/`);
          toast.success("Student deleted");
          await refresh();
        }}
      />
    </>
  );
}
