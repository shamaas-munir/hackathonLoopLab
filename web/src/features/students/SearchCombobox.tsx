"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiGet, toQueryString, type Paginated } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "./useDebouncedValue";

type SearchComboboxProps<T extends { id: string }> = {
  id?: string;
  /** Path under /api/v1 that supports `search` and `page_size`. */
  endpoint: string;
  queryKey: readonly unknown[];
  selectedLabel?: string;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  getLabel: (item: T) => string;
  isSelected?: (item: T) => boolean;
  onSelect: (item: T) => void;
  /** Extra items under the results, e.g. "+ Add program". Receives a close callback. */
  footer?: (close: () => void) => React.ReactNode;
  invalid?: boolean;
  describedBy?: string;
};

/** Combobox whose options come from a paginated, server-searched admin list. */
export function SearchCombobox<T extends { id: string }>({
  id,
  endpoint,
  queryKey,
  selectedLabel,
  placeholder,
  searchPlaceholder,
  emptyText,
  getLabel,
  isSelected,
  onSelect,
  footer,
  invalid,
  describedBy,
}: SearchComboboxProps<T>) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const search = useDebouncedValue(input.trim());

  const query = useQuery({
    queryKey: [...queryKey, "search", search],
    queryFn: () => apiGet<Paginated<T>>(`${endpoint}${toQueryString({ search, page_size: 10 })}`),
    enabled: open,
  });

  const close = () => setOpen(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={cn(
            "h-11 w-full justify-between px-2.5 font-normal md:h-9",
            !selectedLabel && "text-muted-foreground",
            invalid && "border-destructive",
          )}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-64 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={input} onValueChange={setInput} placeholder={searchPlaceholder} />
          <CommandList>
            {query.isFetching && !query.data ? (
              <div className="flex justify-center py-6" aria-label="Loading">
                <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden />
              </div>
            ) : (
              <CommandEmpty>{emptyText}</CommandEmpty>
            )}
            {query.data && query.data.results.length > 0 && (
              <CommandGroup>
                {query.data.results.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    data-checked={isSelected?.(item)}
                    onSelect={() => {
                      onSelect(item);
                      close();
                    }}
                    className="min-h-11 md:min-h-9"
                  >
                    <span className="min-w-0 break-words">{getLabel(item)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {footer?.(close)}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
