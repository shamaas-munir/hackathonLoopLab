"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Info, Lock, Search, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  assignmentsKey,
  isAssignmentComplete,
  isDatesheetLocked,
  MAX_COURSES,
  MIN_COURSES,
  studentKey,
  studentsKey,
  useStudent,
  type CourseBrief,
} from "@/features/students/api";
import { useDebouncedValue } from "@/features/students/useDebouncedValue";
import { ApiError, apiGet, apiPut, toQueryString, type Paginated } from "@/lib/api";
import { cn } from "@/lib/utils";

type ManageCoursesDialogProps = {
  /** Student whose courses are edited; null keeps the dialog closed. */
  studentId: string | null;
  onOpenChange: (open: boolean) => void;
};

export function ManageCoursesDialog({ studentId, onOpenChange }: ManageCoursesDialogProps) {
  const queryClient = useQueryClient();
  const student = useStudent(studentId);
  const [input, setInput] = useState("");
  const search = useDebouncedValue(input.trim());
  const [picked, setPicked] = useState<Map<string, CourseBrief> | null>(null);
  const [saving, setSaving] = useState(false);

  // A different student starts from their own saved set.
  const [shownId, setShownId] = useState(studentId);
  if (studentId !== shownId) {
    setShownId(studentId);
    setPicked(null);
    setInput("");
  }

  const courses = useQuery({
    queryKey: ["courses", "picker", search],
    queryFn: () =>
      apiGet<Paginated<CourseBrief>>(
        `/admin/courses/${toQueryString({ search, status: "active", page_size: 20 })}`,
      ),
    enabled: studentId !== null,
    placeholderData: keepPreviousData,
  });

  const data = student.data;
  const saved = new Map((data?.assignments ?? []).map((a) => [a.course.id, a.course]));
  const selected = picked ?? saved;
  const count = selected.size;
  const locked = data ? isDatesheetLocked(data) : false;
  const unchanged = count === saved.size && [...selected.keys()].every((id) => saved.has(id));
  const canSave = Boolean(data) && !locked && !unchanged && isAssignmentComplete(count);

  // Chosen courses first, then search results that aren't chosen yet.
  const rows = [
    ...[...selected.values()].filter((c) => !search || matches(c, search)),
    ...(courses.data?.results ?? []).filter((c) => !selected.has(c.id)),
  ];

  function toggle(course: CourseBrief, checked: boolean) {
    const next = new Map(selected);
    if (checked) next.set(course.id, course);
    else next.delete(course.id);
    setPicked(next);
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    try {
      await apiPut(`/admin/students/${data.id}/assignments/`, { course_ids: [...selected.keys()] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: studentKey(data.id) }),
        queryClient.invalidateQueries({ queryKey: studentsKey }),
        queryClient.invalidateQueries({ queryKey: assignmentsKey }),
      ]);
      toast.success(`Courses updated for ${data.full_name}`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update the courses.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog
      open={studentId !== null}
      onOpenChange={onOpenChange}
      title="Manage courses"
      description={data ? `${data.full_name} (${data.registration_no})` : "Loading student..."}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton loading={saving} disabled={!canSave} onClick={() => void save()}>
            Save courses
          </LoadingButton>
        </>
      }
    >
      <div className="space-y-4">
        {data && locked && (
          <Banner icon={Lock} tone="neutral">
            Date sheet already saved. Changes need an approved date sheet change request.
          </Banner>
        )}
        {data && !locked && data.datesheet_saved_at && (
          <Banner icon={Info} tone="info">
            Date sheet change approved. Removing a course also removes its chosen exam slot.
          </Banner>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Counter count={count} />
          <p className="text-xs text-muted-foreground">
            Choose {MIN_COURSES} to {MAX_COURSES} active courses.
          </p>
        </div>

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="search"
            inputMode="search"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search code or title"
            aria-label="Search courses"
            className="pl-9"
            disabled={locked}
          />
        </div>

        {!data || (courses.isPending && !courses.data) ? (
          <div className="space-y-2" aria-hidden>
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {courses.isError ? "Could not load courses." : "No courses match your search."}
          </p>
        ) : (
          <ul className="divide-y rounded-lg border" aria-label="Courses">
            {rows.map((course) => {
              const checked = selected.has(course.id);
              const disabled = locked || (!checked && count >= MAX_COURSES);
              return (
                <li key={course.id}>
                  <label
                    className={cn(
                      "flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2",
                      disabled && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      disabled={disabled}
                      onCheckedChange={(value) => toggle(course, value === true)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{course.code}</span>
                      <span className="block text-sm break-words text-muted-foreground">{course.title}</span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{course.credit_hours} cr</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </ResponsiveDialog>
  );
}

const matches = (c: CourseBrief, q: string) =>
  `${c.code} ${c.title}`.toLowerCase().includes(q.toLowerCase());

function Counter({ count }: { count: number }) {
  const ok = isAssignmentComplete(count);
  const Icon = ok ? CircleCheck : TriangleAlert;
  return (
    <span
      aria-live="polite"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium tabular-nums",
        ok ? "border-success/30 bg-success/10" : "border-warning/35 bg-warning/10",
      )}
    >
      <Icon className={cn("size-4", ok ? "text-success" : "text-warning")} aria-hidden />
      {count} / {MAX_COURSES}
      <span className="sr-only">courses selected</span>
    </span>
  );
}

function Banner({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof Lock;
  tone: "neutral" | "info";
  children: React.ReactNode;
}) {
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-sm",
        tone === "info" ? "border-primary/25 bg-primary-soft" : "bg-muted",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      {children}
    </p>
  );
}
