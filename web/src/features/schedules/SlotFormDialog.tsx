"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, startOfToday } from "date-fns";
import { CalendarDays, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormField, type FormFieldControlProps } from "@/components/shared/FormField";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, apiPost, apiPut, applyFieldErrors } from "@/lib/api";
import { cn } from "@/lib/utils";
import { slotsKey, type Slot, type SlotInput } from "./types";
import { useCourseOptions } from "./useCourseOptions";

/** 08:00 to 20:00 in 15-minute steps. */
const TIMES = Array.from({ length: 49 }, (_, i) => {
  const minutes = 8 * 60 + i * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
});
const NO_END = "none";

const schema = z
  .object({
    course: z.string().min(1, "Choose a course."),
    date: z.string().min(1, "Pick a date."),
    start_time: z.string().min(1, "Pick a start time."),
    end_time: z.string(),
    capacity_per_branch: z
      .string()
      .trim()
      .refine((v) => v === "" || (/^\d+$/.test(v) && Number(v) >= 1), "Enter a whole number of 1 or more."),
  })
  .refine((v) => v.end_time === NO_END || v.end_time > v.start_time, {
    path: ["end_time"],
    message: "End time must be after the start time.",
  });

type FormValues = z.infer<typeof schema>;

type SlotFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: Slot | null;
};

export default function SlotFormDialog({ open, onOpenChange, slot }: SlotFormDialogProps) {
  const queryClient = useQueryClient();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      course: slot?.course ?? "",
      date: slot?.date ?? "",
      start_time: slot?.start_time ?? "09:00",
      end_time: slot ? (slot.end_time ?? NO_END) : "12:00",
      capacity_per_branch: slot?.capacity_per_branch?.toString() ?? "",
    },
  });

  const save = useMutation({
    mutationFn: (body: SlotInput) =>
      slot ? apiPut<Slot>(`/admin/slots/${slot.id}/`, body) : apiPost<Slot>("/admin/slots/", body),
    onSuccess: (saved) => {
      toast.success(`${slot ? "Slot updated" : "Slot added"}: ${saved.course_code} on ${saved.day}.`);
      void queryClient.invalidateQueries({ queryKey: slotsKey });
      onOpenChange(false);
    },
    onError: (err) => {
      if (!applyFieldErrors(form.setError, err)) {
        toast.error(err instanceof ApiError ? err.message : "Could not save the slot.");
      }
    },
  });

  const onSubmit = form.handleSubmit((values) =>
    save.mutate({
      course: values.course,
      date: values.date,
      start_time: values.start_time,
      end_time: values.end_time === NO_END ? null : values.end_time,
      capacity_per_branch: values.capacity_per_branch ? Number(values.capacity_per_branch) : null,
    }),
  );

  const startTime = useWatch({ control: form.control, name: "start_time" });

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={slot ? "Edit exam slot" : "Add exam slot"}
      description="Times are Pakistan time. Slots apply at every branch."
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <LoadingButton type="submit" form="slot-form" loading={save.isPending}>
            {slot ? "Save changes" : "Add slot"}
          </LoadingButton>
        </>
      }
    >
      <form id="slot-form" onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormField control={form.control} name="course" label="Course" required>
          {(field) => <CoursePicker {...field} currentCourse={slot?.course} />}
        </FormField>
        <FormField control={form.control} name="date" label="Date" required>
          {(field) => <DatePicker {...field} />}
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="start_time" label="Start time" required>
            {({ value, onChange, id, ...aria }) => (
              <Select value={value} onValueChange={onChange}>
                <SelectTrigger id={id} className="w-full" aria-invalid={aria["aria-invalid"]}>
                  <SelectValue placeholder="Start" />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-64">
                  {TIMES.slice(0, -1).map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField control={form.control} name="end_time" label="End time">
            {({ value, onChange, id, ...aria }) => (
              <Select value={value} onValueChange={onChange}>
                <SelectTrigger id={id} className="w-full" aria-invalid={aria["aria-invalid"]}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="max-h-64">
                  <SelectItem value={NO_END}>No end (3 h)</SelectItem>
                  {TIMES.filter((t) => t > startTime).map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
        </div>
        <FormField
          control={form.control}
          name="capacity_per_branch"
          label="Seats per branch"
          description="Leave empty for unlimited seats."
        >
          {(field) => <Input {...field} inputMode="numeric" placeholder="Unlimited" autoComplete="off" />}
        </FormField>
      </form>
    </ResponsiveDialog>
  );
}

type PickerProps = FormFieldControlProps<FormValues, "course" | "date">;

function CoursePicker({ value, onChange, id, currentCourse, ...aria }: PickerProps & { currentCourse?: string }) {
  const [open, setOpen] = useState(false);
  const { data: courses = [], isPending } = useCourseOptions();
  // Inactive courses can't get new slots (D15); keep the slot's own course selectable when editing.
  const choices = courses.filter((c) => c.status === "active" || c.id === currentCourse);
  const selected = courses.find((c) => c.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={aria["aria-invalid"]}
          aria-describedby={aria["aria-describedby"]}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? `${selected.code} - ${selected.title}` : isPending ? "Loading courses..." : "Choose a course"}
          </span>
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder="Search code or title" className="text-base md:text-sm" />
          <CommandList>
            <CommandEmpty>No active course found.</CommandEmpty>
            {choices.map((c) => (
              <CommandItem
                key={c.id}
                value={`${c.code} ${c.title}`}
                data-checked={c.id === value}
                onSelect={() => {
                  onChange(c.id);
                  setOpen(false);
                }}
              >
                <span className="font-medium">{c.code}</span>
                <span className="truncate text-muted-foreground">{c.title}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function DatePicker({ value, onChange, id, ...aria }: PickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          aria-invalid={aria["aria-invalid"]}
          aria-describedby={aria["aria-describedby"]}
          className="w-full justify-start font-normal"
        >
          <CalendarDays className="text-muted-foreground" aria-hidden />
          <span className={cn(!selected && "text-muted-foreground")}>
            {selected ? format(selected, "EEE d MMM yyyy") : "Pick a date"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          disabled={{ before: startOfToday() }}
          onSelect={(day) => {
            if (day) onChange(format(day, "yyyy-MM-dd"));
            setOpen(false);
          }}
          className="[--cell-size:--spacing(10)] md:[--cell-size:--spacing(8)]"
        />
      </PopoverContent>
    </Popover>
  );
}
