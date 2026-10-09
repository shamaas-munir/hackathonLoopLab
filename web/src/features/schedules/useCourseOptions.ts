"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet, type Paginated } from "@/lib/api";
import type { CourseOption } from "./types";

/** Course lookup for the filter and the slot form (one small cached request, shared by both). */
export function useCourseOptions() {
  return useQuery({
    queryKey: ["courses", "options"],
    queryFn: () => apiGet<Paginated<CourseOption>>("/admin/courses/?page_size=50&ordering=code"),
    select: (data) => data.results,
    staleTime: 5 * 60_000,
  });
}
