"use client";

import { useQuery } from "@tanstack/react-query";
import type { components } from "@/api/schema";
import { apiGet, apiPost, clearRoleCookie } from "@/lib/api";

export type Me = components["schemas"]["Me"];

export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: () => apiGet<Me>("/auth/me/") });
}

export async function logout() {
  await apiPost("/auth/logout/").catch(() => undefined);
  clearRoleCookie();
  // Hard reload: drops cached queries and routes kept alive by Cache Components.
  window.location.replace("/login");
}
