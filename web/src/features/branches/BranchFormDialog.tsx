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
import { StatusSelect } from "./StatusSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, apiPatch, apiPost, applyFieldErrors } from "@/lib/api";

export type Branch = components["schemas"]["Branch"];

const schema = z.object({
  name: z.string().trim().min(2, "Name must be 2 to 100 characters.").max(100, "Name must be 2 to 100 characters."),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, "Code must be 2 to 10 letters or digits, e.g. LHR."),
  city: z.string().trim().min(2, "City must be 2 to 60 characters.").max(60, "City must be 2 to 60 characters."),
  address: z.string().trim().min(5, "Address must be 5 to 255 characters.").max(255, "Address must be 5 to 255 characters."),
  contact_number: z
    .string()
    .trim()
    .regex(
      /^(03\d{2}-?\d{7}|\+923\d{9}|0\d{2,3}-\d{6,8})$/,
      "Use 03XXXXXXXXX, +923XXXXXXXXX or a landline like 042-35761234.",
    ),
  status: z.enum(["active", "inactive"]),
});
type Values = z.infer<typeof schema>;

const EMPTY: Values = { name: "", code: "", city: "", address: "", contact_number: "", status: "active" };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: Branch | null;
  onSaved: () => void;
};

export function BranchFormDialog({ open, onOpenChange, branch, onSaved }: Props) {
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    if (open) form.reset(branch ? { ...EMPTY, ...branch, status: branch.status ?? "active" } : EMPTY);
  }, [open, branch, form]);

  async function onSubmit(values: Values) {
    try {
      if (branch) await apiPatch(`/admin/branches/${branch.id}/`, values);
      else await apiPost("/admin/branches/", values);
      toast.success(branch ? "Branch updated." : "Branch added.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      if (!applyFieldErrors(form.setError, err)) {
        toast.error(err instanceof ApiError ? err.message : "Could not save the branch.");
      }
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={branch ? "Edit branch" : "Add branch"}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="branch-form" loading={form.formState.isSubmitting}>
            {branch ? "Save changes" : "Add branch"}
          </LoadingButton>
        </>
      }
    >
      <form id="branch-form" onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
        <FormField control={form.control} name="name" label="Name" required className="sm:col-span-2">
          {(field) => <Input autoComplete="off" {...field} />}
        </FormField>
        <FormField control={form.control} name="code" label="Code" required>
          {(field) => <Input autoComplete="off" className="uppercase" {...field} />}
        </FormField>
        <FormField control={form.control} name="city" label="City" required>
          {(field) => <Input autoComplete="address-level2" {...field} />}
        </FormField>
        <FormField control={form.control} name="address" label="Address" required className="sm:col-span-2">
          {(field) => <Input autoComplete="street-address" {...field} />}
        </FormField>
        <FormField control={form.control} name="contact_number" label="Contact number" required>
          {(field) => <Input type="tel" inputMode="tel" autoComplete="tel" {...field} />}
        </FormField>
        <FormField control={form.control} name="status" label="Status" required>
          {(field) => <StatusSelect {...field} />}
        </FormField>
      </form>
    </ResponsiveDialog>
  );
}
