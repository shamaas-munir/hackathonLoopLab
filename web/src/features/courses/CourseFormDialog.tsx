"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { components } from "@/api/schema";
import { FormField } from "@/components/shared/FormField";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusSelect } from "@/features/branches/StatusSelect";
import { ApiError, apiPatch, apiPost, applyFieldErrors } from "@/lib/api";
import { DepartmentCombobox } from "./DepartmentCombobox";

export type Course = components["schemas"]["Course"];

const schema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,6}[0-9]{2,4}[A-Z]?$/, "Use a code like CS101: letters followed by digits."),
  title: z.string().trim().min(2, "Title must be 2 to 150 characters.").max(150, "Title must be 2 to 150 characters."),
  credit_hours: z.coerce
    .number({ invalid_type_error: "Enter credit hours." })
    .int("Credit hours must be a whole number.")
    .min(1, "Credit hours must be between 1 and 6.")
    .max(6, "Credit hours must be between 1 and 6."),
  department: z.string().min(1, "Choose a department."),
  status: z.enum(["active", "inactive"]),
});
type Values = z.infer<typeof schema>;
type FormInput = z.input<typeof schema>;

const EMPTY: FormInput = { code: "", title: "", credit_hours: 3, department: "", status: "active" };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course | null;
  onSaved: () => void;
};

export function CourseFormDialog({ open, onOpenChange, course, onSaved }: Props) {
  const form = useForm<FormInput, unknown, Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    if (open) form.reset(course ? { ...course, status: course.status ?? "active" } : EMPTY);
  }, [open, course, form]);

  async function onSubmit(values: Values) {
    try {
      if (course) await apiPatch(`/admin/courses/${course.id}/`, values);
      else await apiPost("/admin/courses/", values);
      toast.success(course ? "Course updated." : "Course added.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (!applyFieldErrors(form.setError, err)) {
        toast.error(err instanceof ApiError ? err.message : "Could not save the course.");
      }
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={course ? "Edit course" : "Add course"}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="course-form" loading={form.formState.isSubmitting}>
            {course ? "Save changes" : "Add course"}
          </LoadingButton>
        </>
      }
    >
      <form id="course-form" onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
        <FormField control={form.control} name="code" label="Code" required>
          {(field) => <Input autoComplete="off" className="uppercase" {...field} />}
        </FormField>
        <FormField control={form.control} name="credit_hours" label="Credit hours" required>
          {(field) => (
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={6}
              {...field}
              value={field.value as number | string}
            />
          )}
        </FormField>
        <FormField control={form.control} name="title" label="Title" required className="sm:col-span-2">
          {(field) => <Input autoComplete="off" {...field} />}
        </FormField>
        <FormField control={form.control} name="department" label="Department" required>
          {(field) => (
            <DepartmentCombobox
              key={course?.id ?? "new"}
              id={field.id}
              value={field.value}
              onChange={field.onChange}
              selectedName={course?.department_name}
              aria-invalid={field["aria-invalid"]}
              aria-describedby={field["aria-describedby"]}
            />
          )}
        </FormField>
        <FormField control={form.control} name="status" label="Status" required>
          {(field) => <StatusSelect {...field} />}
        </FormField>
      </form>
    </ResponsiveDialog>
  );
}
