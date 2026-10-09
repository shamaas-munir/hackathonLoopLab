"use client";

import { useId } from "react";
import {
  Controller,
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from "react-hook-form";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type FormFieldControlProps<T extends FieldValues, N extends FieldPath<T>> =
  ControllerRenderProps<T, N> & {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby"?: string;
  };

type FormFieldProps<T extends FieldValues, N extends FieldPath<T>> = {
  control: Control<T>;
  name: N;
  label: string;
  description?: React.ReactNode;
  required?: boolean;
  className?: string;
  /** Spread the props onto the input: `{(field) => <Input {...field} />}` */
  children: (field: FormFieldControlProps<T, N>) => React.ReactNode;
};

export function FormField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  required,
  className,
  children,
}: FormFieldProps<T, N>) {
  const id = useId();
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const error = fieldState.error?.message;
        const describedBy =
          [description && descriptionId, error && errorId].filter(Boolean).join(" ") || undefined;
        return (
          <div className={cn("grid gap-1.5", className)}>
            <Label htmlFor={id}>
              {label}
              {required && (
                <span className="text-danger" aria-hidden>
                  *
                </span>
              )}
            </Label>
            {children({
              ...field,
              id,
              "aria-invalid": Boolean(error),
              "aria-describedby": describedBy,
            })}
            {description && (
              <p id={descriptionId} className="text-xs text-muted-foreground">
                {description}
              </p>
            )}
            {error && (
              <p id={errorId} className="text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        );
      }}
    />
  );
}
