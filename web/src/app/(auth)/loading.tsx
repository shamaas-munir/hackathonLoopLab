import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4 rounded-xl border bg-card p-6 shadow-sm sm:p-8">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-5 w-64 max-w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
