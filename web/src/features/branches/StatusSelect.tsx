"use client";

import type { FieldPath, FieldValues } from "react-hook-form";
import type { FormFieldControlProps } from "@/components/shared/FormField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

/** Active / inactive picker for branch and course forms. */
export function StatusSelect<T extends FieldValues, N extends FieldPath<T>>({
  value,
  onChange,
  id,
  ...aria
}: FormFieldControlProps<T, N>) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        id={id}
        className="w-full"
        aria-invalid={aria["aria-invalid"]}
        aria-describedby={aria["aria-describedby"]}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {STATUS_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
