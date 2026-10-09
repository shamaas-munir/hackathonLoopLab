import { Skeleton } from "@/components/ui/skeleton";

/** Route-level loading UI: header plus a content card. */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 mb-6 h-5 w-72 max-w-full" />
      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
