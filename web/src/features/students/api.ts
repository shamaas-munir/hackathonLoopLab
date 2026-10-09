"use client";

import { useQuery } from "@tanstack/react-query";
import type { components } from "@/api/schema";
import { apiGet, type Paginated } from "@/lib/api";

export type StudentRow = components["schemas"]["StudentList"];
export type StudentDetail = components["schemas"]["StudentDetail"];
export type StudentCreated = components["schemas"]["StudentCreated"];
export type Program = components["schemas"]["Program"];
export type CourseBrief = components["schemas"]["CourseBrief"];

export const MIN_COURSES = 4;
export const MAX_COURSES = 6;

export const studentsKey = ["students"] as const;
export const studentKey = (id: string) => ["student", id] as const;
export const programsKey = ["programs"] as const;
export const assignmentsKey = ["assignments"] as const;

export function useStudent(id: string | null) {
  return useQuery({
    queryKey: studentKey(id ?? ""),
    queryFn: () => apiGet<StudentDetail>(`/admin/students/${id}/`),
    enabled: Boolean(id),
  });
}

/** Lookup lists for filters and selects (small tables, one page of 50 is plenty). */
export function useLookup<T>(key: readonly unknown[], endpoint: string) {
  return useQuery({
    queryKey: [...key, "lookup"],
    queryFn: () => apiGet<Paginated<T>>(`${endpoint}?page_size=50`),
    staleTime: 5 * 60_000,
    select: (data) => data.results,
  });
}

export const isDatesheetLocked = (s: { datesheet_saved_at: string | null; datesheet_unlocked: boolean }) =>
  s.datesheet_saved_at !== null && !s.datesheet_unlocked;

export const isAssignmentComplete = (count: number) => count >= MIN_COURSES && count <= MAX_COURSES;
