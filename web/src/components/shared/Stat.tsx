import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type StatProps = {
  icon: LucideIcon;
  label: string;
  value?: React.ReactNode;
  hint?: React.ReactNode;
  loading?: boolean;
};

export function Stat({ icon: Icon, label, value, hint, loading = false }: StatProps) {
  return (
    <div className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-8 w-16" />
        ) : (
          <p className="text-2xl leading-8 font-semibold tabular-nums">{value}</p>
        )}
        {hint && !loading && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
