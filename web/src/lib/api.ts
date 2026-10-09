import type { FieldValues, Path, UseFormSetError } from "react-hook-form";

const API_PREFIX = "/api/v1";

export type Paginated<T> = {
  results: T[];
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
};

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiInit = Omit<RequestInit, "body"> & { body?: unknown };

const NO_REFRESH = ["/auth/login/", "/auth/refresh/", "/auth/logout/"];
let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_PREFIX}/auth/refresh/`, {
    method: "POST",
    credentials: "include",
  })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

function send(path: string, { body, headers, ...init }: ApiInit) {
  const isRaw = body === undefined || body instanceof FormData;
  return fetch(`${API_PREFIX}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(isRaw ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: isRaw ? (body as FormData | undefined) : JSON.stringify(body),
  });
}

function flattenFieldErrors(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([key, value]) => [
      key,
      Array.isArray(value) ? String(value[0]) : String(value),
    ]),
  );
}

async function toApiError(res: Response): Promise<ApiError> {
  const data = await res.json().catch(() => null);
  const error = data?.error;
  return new ApiError(
    res.status,
    error?.code ?? "UNKNOWN",
    error?.message ?? "Something went wrong. Please try again.",
    flattenFieldErrors(error?.field_errors),
  );
}

export function clearRoleCookie() {
  document.cookie = "role=; Max-Age=0; path=/";
}

export async function apiFetch<T>(path: string, init: ApiInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await send(path, init);
    if (res.status === 401 && !NO_REFRESH.includes(path)) {
      if (await refreshSession()) res = await send(path, init);
      if (res.status === 401 && typeof window !== "undefined") {
        clearRoleCookie();
        window.location.replace("/login"); // full reload drops cached data
      }
    }
  } catch {
    throw new ApiError(0, "NETWORK", "Could not reach the server. Check your connection.");
  }
  if (!res.ok) throw await toApiError(res);
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const apiGet = <T>(path: string) => apiFetch<T>(path);
export const apiPost = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "POST", body });
export const apiPut = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "PUT", body });
export const apiPatch = <T>(path: string, body?: unknown) =>
  apiFetch<T>(path, { method: "PATCH", body });
export const apiDelete = <T = void>(path: string) => apiFetch<T>(path, { method: "DELETE" });

export function toQueryString(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Maps API field errors onto react-hook-form fields. Returns true if any were applied. */
export function applyFieldErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  err: unknown,
): boolean {
  if (!(err instanceof ApiError)) return false;
  const entries = Object.entries(err.fieldErrors);
  for (const [field, message] of entries) {
    setError(field as Path<T>, { type: "server", message });
  }
  return entries.length > 0;
}
