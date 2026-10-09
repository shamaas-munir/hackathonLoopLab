"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAGE_SIZES } from "./useListParams";

type DataTablePaginationProps = {
  page: number;
  pageSize: number;
  count: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
};

/** 1 … 4 5 6 … 12 */
function pageItems(page: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | "gap")[] = [1];
  const start = Math.max(2, Math.min(page - 1, total - 4));
  const end = Math.min(total - 1, Math.max(page + 1, 5));
  if (start > 2) items.push("gap");
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total - 1) items.push("gap");
  items.push(total);
  return items;
}

export function DataTablePagination({
  page,
  pageSize,
  count,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: DataTablePaginationProps) {
  const from = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, count);
  const pages = Math.max(totalPages, 1);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p aria-live="polite">
          Showing {from} to {to} of {count}
        </p>
        <label className="flex items-center gap-2">
          <span>Rows</span>
          <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
            <SelectTrigger className="w-20" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="flex items-center justify-between gap-2 md:justify-end">
        <Button
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft aria-hidden />
          <span className="md:sr-only">Prev</span>
        </Button>
        <span className="md:hidden">
          Page {page} of {pages}
        </span>
        <ul className="hidden items-center gap-1 md:flex">
          {pageItems(page, pages).map((item, i) =>
            item === "gap" ? (
              <li key={`gap-${i}`} className="px-1" aria-hidden>
                …
              </li>
            ) : (
              <li key={item}>
                <Button
                  variant={item === page ? "default" : "ghost"}
                  size="icon"
                  aria-current={item === page ? "page" : undefined}
                  aria-label={`Page ${item}`}
                  onClick={() => onPageChange(item)}
                >
                  {item}
                </Button>
              </li>
            ),
          )}
        </ul>
        <Button
          variant="outline"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <span className="md:sr-only">Next</span>
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
