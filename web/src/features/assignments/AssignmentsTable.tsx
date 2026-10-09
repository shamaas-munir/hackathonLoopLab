"use client";

import { BookOpen, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import type { components } from "@/api/schema";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useQueryClient } from "@tanstack/react-query";
import {
  assignmentsKey,
  programsKey,
  studentKey,
  studentsKey,
  useLookup,
  type CourseBrief,
  type Program,
  type StudentRow,
} from "@/features/students/api";
import { SearchCombobox } from "@/features/students/SearchCombobox";
import { CourseCount } from "@/features/students/StudentBadges";
import { apiDelete } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { ManageCoursesDialog } from "./ManageCoursesDialog";

type AssignmentRow = components["schemas"]["AssignmentList"];

const columns: DataTableColumn<AssignmentRow>[] = [
  {
    id: "student",
    header: "Student",
    sortField: "student__full_name",
    cell: (a) => (
      <Link href={`/admin/students/${a.student_id}`} className="block min-w-0 hover:underline">
        <span className="block font-medium break-words">{a.student_name}</span>
        <span className="block text-xs text-muted-foreground">{a.registration_no}</span>
      </Link>
    ),
  },
  { id: "program", header: "Program", hideBelow: "lg", cell: (a) => a.program_name },
  {
    id: "course",
    header: "Course",
    sortField: "course__code",
    cell: (a) => (
      <span className="block min-w-0">
        <span className="font-medium">{a.course.code}</span>
        <span className="block text-xs break-words text-muted-foreground">{a.course.title}</span>
      </span>
    ),
  },
  { id: "count", header: "Student courses", cell: (a) => <CourseCount count={a.student_course_count} /> },
  {
    id: "assigned",
    header: "Assigned",
    sortField: "created_at",
    hideBelow: "lg",
    cell: (a) => formatDate(a.created_at),
  },
];

export function AssignmentsTable() {
  const queryClient = useQueryClient();
  const programs = useLookup<Program>(programsKey, "/admin/programs/");
  const courses = useLookup<CourseBrief>(["courses"], "/admin/courses/");
  const [managing, setManaging] = useState<string | null>(null);
  const [removing, setRemoving] = useState<AssignmentRow | null>(null);

  return (
    <>
      <DataTable<AssignmentRow>
        queryKey={assignmentsKey}
        endpoint="/admin/assignments/"
        columns={columns}
        searchPlaceholder="Search student, reg no or course"
        emptyText="No course assignments found"
        defaultOrdering="student__full_name"
        filters={[
          {
            id: "program",
            label: "Programs",
            options: (programs.data ?? []).map((p) => ({ value: p.id, label: p.name })),
          },
          {
            id: "course",
            label: "Courses",
            options: (courses.data ?? []).map((c) => ({ value: c.id, label: `${c.code} ${c.title}` })),
          },
        ]}
        toolbarActions={
          <div className="w-full sm:w-72">
            <SearchCombobox<StudentRow>
              endpoint="/admin/students/"
              queryKey={studentsKey}
              placeholder="Assign courses to a student..."
              searchPlaceholder="Search name or reg no"
              emptyText="No students found."
              getLabel={(s) => `${s.full_name} (${s.registration_no})`}
              onSelect={(s) => setManaging(s.id)}
            />
          </div>
        }
        rowActions={(a) => [
          { label: "Manage courses", icon: BookOpen, onSelect: () => setManaging(a.student_id) },
          {
            label: "Remove",
            icon: Trash2,
            destructive: true,
            disabled: a.locked,
            onSelect: () => setRemoving(a),
          },
        ]}
      />

      <ManageCoursesDialog studentId={managing} onOpenChange={(open) => !open && setManaging(null)} />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.course.code ?? "course"}?`}
        description={`${removing?.course.title ?? "This course"} will be removed from ${removing?.student_name ?? "the student"}.`}
        confirmText="Remove course"
        destructive
        onConfirm={async () => {
          await apiDelete(`/admin/assignments/${removing!.id}/`);
          toast.success("Course removed");
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: assignmentsKey }),
            queryClient.invalidateQueries({ queryKey: studentsKey }),
            queryClient.invalidateQueries({ queryKey: studentKey(removing!.student_id) }),
          ]);
        }}
      />
    </>
  );
}
