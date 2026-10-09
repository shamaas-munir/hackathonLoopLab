"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CalendarX, CircleAlert, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import { studentKeys, useCourses, type CourseSlots, type Datesheet, type SlotOption } from "./api";
import { findConflicts } from "./conflicts";
import { formatSlot } from "./format";
import { StickyActionBar } from "./StickyActionBar";

function seatsLabel(slot: SlotOption, selected: boolean) {
  if (slot.seats_left === null) return null;
  if (slot.seats_left === 0) return selected ? "your seat is kept" : "full";
  return `${slot.seats_left} ${slot.seats_left === 1 ? "seat" : "seats"} left`;
}

export function DatesheetDesigner({ unlocked }: { unlocked: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const courses = useCourses(true);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Current choices (if any) start preselected; slots that disappeared (full, removed) drop out.
  const chosen = useMemo(() => {
    const result: Record<string, SlotOption> = {};
    for (const { course, slots, selected_slot } of courses.data ?? []) {
      const id = picked[course.id] ?? selected_slot;
      const slot = slots.find((s) => s.id === id);
      if (slot) result[course.id] = slot;
    }
    return result;
  }, [courses.data, picked]);

  const conflicts = useMemo(() => findConflicts(courses.data ?? [], chosen), [courses.data, chosen]);
  const clashing = new Set(conflicts.flatMap((c) => c.courseIds));

  if (courses.isPending) return <DesignerSkeleton />;
  if (courses.isError) return <ErrorState onRetry={() => void courses.refetch()} />;

  const total = courses.data.length;
  const done = Object.keys(chosen).length;
  const canSave = done === total && conflicts.length === 0;

  async function save() {
    try {
      const saved = await apiPost<Datesheet>("/me/datesheet/", {
        selections: Object.entries(chosen).map(([course, slot]) => ({ course, slot: slot.id })),
      });
      queryClient.setQueryData(studentKeys.datesheet, saved);
      // The date sheet page is guarded by flow state, so refresh it before navigating.
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: studentKeys.profile });
      toast.success("Date sheet saved.");
      router.push("/student/datesheet");
    } catch (err) {
      if (err instanceof ApiError && (err.code === "SLOT_FULL" || err.code === "SLOT_CONFLICT")) {
        // Seats moved under us: show fresh numbers, the toast explains what to change.
        void queryClient.invalidateQueries({ queryKey: studentKeys.courses });
      }
      throw err;
    }
  }

  return (
    <section aria-labelledby="designer-title">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="designer-title" className="text-lg font-semibold">
            Choose your exam slots
          </h2>
          <p className="text-sm text-muted-foreground">
            Pick one date and time for each course. Exams cannot overlap.
          </p>
        </div>
        <div className="w-full sm:w-56" aria-live="polite">
          <p className="mb-1 text-sm font-medium">
            {done} of {total} scheduled
          </p>
          <Progress value={total ? (done / total) * 100 : 0} aria-label="Courses scheduled" />
        </div>
      </div>

      {unlocked && (
        <div
          role="status"
          className="mb-4 flex gap-3 rounded-xl border border-primary/25 bg-primary-soft p-4 text-sm"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p>Your date sheet change was approved. You can edit it once.</p>
        </div>
      )}

      {conflicts.length > 0 && (
        <div
          role="alert"
          className="mb-4 flex gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <div>
            <p className="font-medium">These exams overlap. Pick a different time for one of them.</p>
            <ul className="mt-1 list-disc pl-4">
              {conflicts.map((c) => (
                <li key={c.message}>{c.message}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <ul className="grid gap-3 lg:grid-cols-2">
        {courses.data.map((item) => (
          <CourseCard
            key={item.course.id}
            item={item}
            value={chosen[item.course.id]?.id ?? ""}
            clashing={clashing.has(item.course.id)}
            onChange={(slotId) => setPicked((prev) => ({ ...prev, [item.course.id]: slotId }))}
          />
        ))}
      </ul>

      <StickyActionBar>
        <p className="min-w-0 flex-1 text-sm text-muted-foreground">
          {conflicts.length > 0
            ? "Resolve the overlaps to save."
            : done < total
              ? `${total - done} more to schedule.`
              : "All courses scheduled."}
        </p>
        <Button size="lg" disabled={!canSave} onClick={() => setConfirmOpen(true)}>
          Save date sheet
        </Button>
      </StickyActionBar>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Save your date sheet?"
        description="Once saved, your date sheet is locked. To change it later you will need an approved request from Need Help."
        confirmText="Save date sheet"
        onConfirm={save}
      />
    </section>
  );
}

type CourseCardProps = {
  item: CourseSlots;
  value: string;
  clashing: boolean;
  onChange: (slotId: string) => void;
};

function CourseCard({ item: { course, slots }, value, clashing, onChange }: CourseCardProps) {
  const labelId = `course-${course.id}`;
  return (
    <li
      className={cn(
        "min-w-0 rounded-xl border bg-card p-4 shadow-sm",
        clashing && "border-danger ring-1 ring-danger/40",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p id={labelId} className="font-medium break-words">
            <span className="text-primary">{course.code}</span> {course.title}
          </p>
          <p className="text-xs text-muted-foreground">{course.credit_hours} credit hours</p>
        </div>
        {clashing && (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-danger">
            <CircleAlert className="size-3.5" aria-hidden />
            Overlap
          </span>
        )}
      </div>

      {slots.length === 0 ? (
        <p className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          <CalendarX className="size-4 shrink-0" aria-hidden />
          No open slots yet. Please check again later or contact the administration.
        </p>
      ) : (
        <RadioGroupPrimitive.Root
          value={value}
          onValueChange={onChange}
          aria-labelledby={labelId}
          className="flex flex-col gap-2"
        >
          {slots.map((slot) => {
            const checked = slot.id === value;
            const seats = seatsLabel(slot, checked);
            return (
              <RadioGroupPrimitive.Item
                key={slot.id}
                value={slot.id}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors outline-none hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50",
                  checked && "border-primary bg-primary-soft",
                  checked && clashing && "border-danger bg-danger/10",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-full border",
                    checked && "border-primary",
                  )}
                >
                  {checked && <span className="size-2 rounded-full bg-primary" />}
                </span>
                <span className="min-w-0 flex-1">
                  {formatSlot(slot.start_at, slot.end_at)}
                  {seats && <span className="text-muted-foreground"> · {seats}</span>}
                </span>
              </RadioGroupPrimitive.Item>
            );
          })}
        </RadioGroupPrimitive.Root>
      )}
    </li>
  );
}

function DesignerSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading courses" className="grid gap-3 lg:grid-cols-2">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-40 rounded-xl" />
      ))}
    </div>
  );
}
