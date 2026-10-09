"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { apiDelete } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { SlotCapacity, SlotChosen, SlotTime } from "./SlotBits";
import { slotsKey, type Slot } from "./types";
import { useCourseOptions } from "./useCourseOptions";

// The form pulls in the calendar and combobox: load it only when an admin opens it.
const SlotFormDialog = dynamic(() => import("./SlotFormDialog"), { ssr: false });

const columns: DataTableColumn<Slot>[] = [
  {
    id: "course",
    header: "Course",
    sortField: "course__code",
    cell: (s) => (
      <div className="min-w-0">
        <p className="font-medium">{s.course_code}</p>
        <p className="truncate text-sm text-muted-foreground">{s.course_title}</p>
      </div>
    ),
  },
  { id: "date", header: "Date", sortField: "start_at", cell: (s) => formatDate(s.start_at) },
  { id: "day", header: "Day", cell: (s) => s.day },
  { id: "time", header: "Time", cell: (s) => <SlotTime slot={s} /> },
  { id: "capacity", header: "Seats", cell: (s) => <SlotCapacity slot={s} /> },
  { id: "chosen", header: "Chosen", sortField: "chosen_count", cell: (s) => <SlotChosen slot={s} /> },
];

function SlotCard({ slot }: { slot: Slot }) {
  return (
    <div className="space-y-2">
      <p className="font-medium break-words">
        {slot.course_code} <span className="font-normal text-muted-foreground">{slot.course_title}</span>
      </p>
      <p className="text-sm">
        {slot.day}, {formatDate(slot.start_at)}
        <br />
        <SlotTime slot={slot} />
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <SlotCapacity slot={slot} />
        <SlotChosen slot={slot} />
      </div>
    </div>
  );
}

export function SlotsView() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<{ slot: Slot | null } | null>(null);
  const [deleting, setDeleting] = useState<Slot | null>(null);
  const { data: courses = [] } = useCourseOptions();

  const actions = (slot: Slot) => {
    const locked = slot.chosen_count > 0;
    return [
      { label: "Edit", icon: Pencil, disabled: locked, onSelect: () => setForm({ slot }) },
      { label: "Delete", icon: Trash2, disabled: locked, destructive: true, onSelect: () => setDeleting(slot) },
    ];
  };

  async function deleteSlot() {
    if (!deleting) return;
    await apiDelete(`/admin/slots/${deleting.id}/`);
    toast.success(`Slot deleted: ${deleting.course_code} on ${formatDate(deleting.start_at)}.`);
    await queryClient.invalidateQueries({ queryKey: slotsKey });
  }

  return (
    <>
      <PageHeader
        title="Exam slots"
        description="Dates and times students can choose for each course. Chosen slots are locked."
        actions={
          <Button onClick={() => setForm({ slot: null })}>
            <Plus aria-hidden /> Add slot
          </Button>
        }
      />

      <DataTable
          queryKey={slotsKey}
          endpoint="/admin/slots/"
          columns={columns}
          mobileCard={(slot) => <SlotCard slot={slot} />}
          filters={[
            {
              id: "course",
              label: "Courses",
              options: courses.map((c) => ({ value: c.id, label: `${c.code} - ${c.title}` })),
            },
            { id: "upcoming", label: "Dates", options: [{ value: "true", label: "Upcoming only" }] },
          ]}
          searchPlaceholder="Search course code or title"
          rowActions={actions}
          emptyText="No exam slots yet"
          defaultOrdering="start_at"
        />

      {form && (
        <SlotFormDialog
          key={form.slot?.id ?? "new"}
          open
          onOpenChange={(open) => !open && setForm(null)}
          slot={form.slot}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete exam slot?"
        description={
          deleting &&
          `${deleting.course_code} on ${deleting.day}, ${formatDate(deleting.start_at)} will be removed. This cannot be undone.`
        }
        confirmText="Delete slot"
        destructive
        onConfirm={deleteSlot}
      />
    </>
  );
}
