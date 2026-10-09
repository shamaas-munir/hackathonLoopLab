"use client";

import { useQuery } from "@tanstack/react-query";
import type { components } from "@/api/schema";
import { apiGet } from "@/lib/api";

type Schemas = components["schemas"];
export type Profile = Schemas["Profile"];
export type Branch = Schemas["MyBranch"];
export type CourseSlots = Schemas["CourseSlots"];
export type SlotOption = Schemas["SlotOption"];
export type Datesheet = Schemas["Datesheet"];
export type ChangeRequest = Schemas["MyRequest"];
export type RequestType = Schemas["TypeEnum"];

/** Everything under ["student"] is the signed-in student's own data. */
export const studentKeys = {
  all: ["student"] as const,
  profile: ["student", "profile"] as const,
  branches: ["student", "branches"] as const,
  courses: ["student", "courses"] as const,
  datesheet: ["student", "datesheet"] as const,
  requests: ["student", "requests"] as const,
};

export const useProfile = () =>
  useQuery({ queryKey: studentKeys.profile, queryFn: () => apiGet<Profile>("/me/profile/") });

export const useBranches = () =>
  useQuery({ queryKey: studentKeys.branches, queryFn: () => apiGet<Branch[]>("/me/branches/") });

export const useCourses = (enabled: boolean) =>
  useQuery({
    queryKey: studentKeys.courses,
    queryFn: () => apiGet<CourseSlots[]>("/me/courses/"),
    enabled,
  });

export const useDatesheet = (enabled: boolean) =>
  useQuery({
    queryKey: studentKeys.datesheet,
    queryFn: () => apiGet<Datesheet>("/me/datesheet/"),
    enabled,
  });

export const useRequests = () =>
  useQuery({
    queryKey: studentKeys.requests,
    queryFn: () => apiGet<ChangeRequest[]>("/me/requests/"),
  });
