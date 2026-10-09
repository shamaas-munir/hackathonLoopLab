"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { components } from "@/api/schema";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ApiError, apiGet, apiPost, toQueryString, type Paginated } from "@/lib/api";

export type Department = components["schemas"]["Department"];
export const DEPARTMENTS_KEY = ["departments"] as const;

type Props = {
  id: string;
  value: string;
  /** Name of the selected department, shown before the list has loaded. */
  selectedName?: string;
  onChange: (id: string) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/** Server-searched department picker with an inline "Add department" form. */
export function DepartmentCombobox({ id, value, selectedName, onChange, ...aria }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", code: "" });
  const [saving, setSaving] = useState(false);
  const [picked, setPicked] = useState<string | undefined>(selectedName);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const qs = toQueryString({ search: debounced, page_size: 20 });
  const { data, isFetching } = useQuery({
    queryKey: [...DEPARTMENTS_KEY, qs],
    queryFn: () => apiGet<Paginated<Department>>(`/admin/departments/${qs}`),
    enabled: open,
    placeholderData: keepPreviousData,
  });

  const label = data?.results.find((d) => d.id === value)?.name ?? (value ? (picked ?? selectedName) : undefined);

  function select(dept: Department) {
    onChange(dept.id);
    setPicked(dept.name);
    setOpen(false);
  }

  async function addDepartment() {
    setSaving(true);
    try {
      const dept = await apiPost<Department>("/admin/departments/", draft);
      toast.success(`Department ${dept.name} added.`);
      await queryClient.invalidateQueries({ queryKey: DEPARTMENTS_KEY });
      setAdding(false);
      setDraft({ name: "", code: "" });
      select(dept);
    } catch (err) {
      const fields = err instanceof ApiError ? Object.values(err.fieldErrors) : [];
      toast.error(fields[0] ?? (err instanceof ApiError ? err.message : "Could not add the department."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setAdding(false);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          {...aria}
        >
          <span className="truncate">{label ?? "Select department"}</span>
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        {adding ? (
          <div className="grid gap-3 p-3">
            <p className="text-sm font-medium">New department</p>
            <Input
              placeholder="Name, e.g. Computer Science"
              aria-label="Department name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <Input
              placeholder="Code, e.g. CS"
              aria-label="Department code"
              className="uppercase"
              value={draft.code}
              onChange={(e) => setDraft({ ...draft, code: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
                Back
              </Button>
              <LoadingButton type="button" loading={saving} onClick={addDepartment}>
                Add
              </LoadingButton>
            </div>
          </div>
        ) : (
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search departments" value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>{isFetching ? "Searching..." : "No departments found."}</CommandEmpty>
              <CommandGroup>
                {data?.results.map((d) => (
                  <CommandItem key={d.id} value={d.id} data-checked={d.id === value} onSelect={() => select(d)}>
                    <span className="truncate">{d.name}</span>
                    <span className="text-xs text-muted-foreground">{d.code}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <div className="border-t p-1">
              <Button
                type="button"
                variant="ghost"
                className="w-full justify-start"
                onClick={() => {
                  setDraft({ name: search.trim(), code: "" });
                  setAdding(true);
                }}
              >
                <Plus aria-hidden />
                Add department
              </Button>
            </div>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
