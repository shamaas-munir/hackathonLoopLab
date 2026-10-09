"use client";

import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { DataTable, useInvalidateList, type DataTableColumn } from "@/components/data-table/DataTable";
import { STATUS_OPTIONS } from "@/features/branches/StatusSelect";
import { apiDelete, apiGet, type Paginated } from "@/lib/api";
import { CourseFormDialog, type Course } from "./CourseFormDialog";
import { DEPARTMENTS_KEY, type Department } from "./DepartmentCombobox";

const QUERY_KEY = ["courses"] as const;

const columns: DataTableColumn<Course>[] = [
  { id: "code", header: "Code", sortField: "code", cell: (c) => <span className="font-medium">{c.code}</span> },
  { id: "title", header: "Title", sortField: "title", cell: (c) => c.title },
  {
    id: "credit_hours",
    header: "Credit hours",
    sortField: "credit_hours",
    cell: (c) => <span className="tabular-nums">{c.credit_hours}</span>,
  },
  { id: "department", header: "Department", sortField: "department__name", cell: (c) => c.department_name },
  { id: "slots", header: "Slots", cell: (c) => <span className="tabular-nums">{c.slots_count}</span>, hideBelow: "lg" },
  {
    id: "assigned",
    header: "Assigned",
    cell: (c) => <span className="tabular-nums">{c.assignments_count}</span>,
    hideBelow: "lg",
  },
  { id: "status", header: "Status", cell: (c) => <StatusBadge status={c.status ?? "active"} /> },
];

function mobileCard(c: Course) {
  return (
    <div className="space-y-2">
      <div className="min-w-0">
        <p className="font-medium break-words">
          {c.code} · {c.title}
        </p>
        <p className="text-sm text-muted-foreground">
          {c.department_name} · {c.credit_hours} credit hours
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <StatusBadge status={c.status ?? "active"} />
        <span>
          {c.slots_count} slots · {c.assignments_count} assigned
        </span>
      </div>
    </div>
  );
}

export function CoursesView() {
  const refresh = useInvalidateList(QUERY_KEY);
  const [editing, setEditing] = useState<Course | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Course | null>(null);

  const { data: departments } = useQuery({
    queryKey: [...DEPARTMENTS_KEY, "filter"],
    queryFn: () => apiGet<Paginated<Department>>("/admin/departments/?page_size=50"),
  });

  const openForm = (course: Course | null) => {
    setEditing(course);
    setFormOpen(true);
  };

  return (
    <>
      <DataTable
        queryKey={QUERY_KEY}
        endpoint="/admin/courses/"
        columns={columns}
        mobileCard={mobileCard}
        filters={[
          { id: "status", label: "Statuses", options: STATUS_OPTIONS },
          {
            id: "department",
            label: "Departments",
            options: departments?.results.map((d) => ({ value: d.id, label: d.name })) ?? [],
          },
        ]}
        searchPlaceholder="Search code, title or department"
        emptyText="No courses yet"
        toolbarActions={
          <Button onClick={() => openForm(null)}>
            <Plus aria-hidden />
            Add course
          </Button>
        }
        rowActions={(c) => [
          { label: "Edit", icon: Pencil, onSelect: () => openForm(c) },
          { label: "Delete", icon: Trash2, destructive: true, onSelect: () => setDeleting(c) },
        ]}
      />

      <CourseFormDialog open={formOpen} onOpenChange={setFormOpen} course={editing} onSaved={refresh} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete course?"
        description={`Delete ${deleting?.code} ${deleting?.title}? This cannot be undone.`}
        confirmText="Delete"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          await apiDelete(`/admin/courses/${deleting.id}/`);
          toast.success(`${deleting.code} deleted.`);
          await refresh();
        }}
      />
    </>
  );
}
