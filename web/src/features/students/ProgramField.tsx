"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormField } from "@/components/shared/FormField";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { CommandGroup, CommandItem, CommandSeparator } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { ApiError, apiPost, applyFieldErrors } from "@/lib/api";
import { programsKey, type Program } from "./api";
import { SearchCombobox } from "./SearchCombobox";

type ProgramFieldProps = {
  id: string;
  value: { id: string; name: string } | null;
  onChange: (program: Program) => void;
  invalid?: boolean;
  describedBy?: string;
};

/** Program combobox with server search and an inline "+ Add program". */
export function ProgramField({ id, value, onChange, invalid, describedBy }: ProgramFieldProps) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <SearchCombobox<Program>
        id={id}
        endpoint="/admin/programs/"
        queryKey={programsKey}
        selectedLabel={value?.name}
        placeholder="Select a program"
        searchPlaceholder="Search programs..."
        emptyText="No programs found."
        getLabel={(p) => `${p.name} (${p.code})`}
        isSelected={(p) => p.id === value?.id}
        onSelect={onChange}
        invalid={invalid}
        describedBy={describedBy}
        footer={(close) => (
          <>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                value="__add_program__"
                className="min-h-11 text-primary md:min-h-9"
                onSelect={() => {
                  close();
                  setAdding(true);
                }}
              >
                <Plus aria-hidden />
                Add program
              </CommandItem>
            </CommandGroup>
          </>
        )}
      />
      <AddProgramDialog
        open={adding}
        onOpenChange={setAdding}
        onCreated={(program) => {
          onChange(program);
          setAdding(false);
        }}
      />
    </>
  );
}

const programSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters.").max(120),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,12}$/, "Use 2 to 12 letters, digits or hyphens."),
  duration_semesters: z
    .string()
    .trim()
    .refine((v) => /^\d{1,2}$/.test(v) && +v >= 1 && +v <= 12, "Enter 1 to 12 semesters."),
});
type ProgramValues = z.infer<typeof programSchema>;

function AddProgramDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (program: Program) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<ProgramValues>({
    resolver: zodResolver(programSchema),
    defaultValues: { name: "", code: "", duration_semesters: "8" },
  });

  const submit = form.handleSubmit(async (values) => {
    try {
      const program = await apiPost<Program>("/admin/programs/", {
        ...values,
        duration_semesters: Number(values.duration_semesters),
      });
      await queryClient.invalidateQueries({ queryKey: programsKey });
      toast.success(`Program ${program.name} added`);
      form.reset();
      onCreated(program);
    } catch (err) {
      if (!applyFieldErrors(form.setError, err)) {
        toast.error(err instanceof ApiError ? err.message : "Could not add the program.");
      }
    }
  });

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add program"
      description="It becomes available for every student."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton loading={form.formState.isSubmitting} onClick={() => void submit()}>
            Add program
          </LoadingButton>
        </>
      }
    >
      {/* Not a <form>: this dialog opens from inside the student form. */}
      <div
        className="grid gap-4"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
      >
        <FormField control={form.control} name="name" label="Name" required>
          {(field) => <Input {...field} placeholder="BS Computer Science" autoComplete="off" />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="code" label="Code" required>
            {(field) => <Input {...field} placeholder="BSCS" autoComplete="off" className="uppercase" />}
          </FormField>
          <FormField control={form.control} name="duration_semesters" label="Duration (semesters)" required>
            {(field) => (
              <Input {...field} inputMode="numeric" maxLength={2} />
            )}
          </FormField>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
