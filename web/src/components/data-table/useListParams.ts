"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export const PAGE_SIZES = [5, 10, 20, 50] as const;
const DEFAULT_PAGE_SIZE = 10;

export type ListParamsPatch = Record<string, string | number | null>;

/** List state (page, page_size, search, ordering, filters) kept in the URL query string. */
export function useListParams(filterIds: readonly string[] = [], defaultOrdering = "") {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const page = Math.max(1, Math.floor(Number(searchParams.get("page"))) || 1);
  const rawSize = Number(searchParams.get("page_size"));
  const pageSize = (PAGE_SIZES as readonly number[]).includes(rawSize) ? rawSize : DEFAULT_PAGE_SIZE;
  const search = searchParams.get("search") ?? "";
  const ordering = searchParams.get("ordering") ?? defaultOrdering;
  const filters: Record<string, string> = {};
  for (const id of filterIds) {
    const value = searchParams.get(id);
    if (value) filters[id] = value;
  }

  const setParams = useCallback(
    (patch: ListParamsPatch) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      if (next.get("page") === "1") next.delete("page");
      if (next.get("page_size") === String(DEFAULT_PAGE_SIZE)) next.delete("page_size");
      if (next.get("ordering") === defaultOrdering) next.delete("ordering");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, router, pathname, defaultOrdering],
  );

  return { page, pageSize, search, ordering, filters, setParams };
}
