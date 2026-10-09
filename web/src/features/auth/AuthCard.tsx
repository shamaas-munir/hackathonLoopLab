import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type AuthCardProps = {
  title: string;
  description?: React.ReactNode;
  icon?: LucideIcon;
  tone?: "primary" | "success" | "danger";
  children?: React.ReactNode;
};

const TONES = {
  primary: "bg-primary-soft text-primary",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
};

export function AuthCard({ title, description, icon: Icon, tone = "primary", children }: AuthCardProps) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm sm:p-8">
      {Icon && (
        <div className={cn("mb-4 flex size-12 items-center justify-center rounded-full", TONES[tone])}>
          <Icon className="size-6" aria-hidden />
        </div>
      )}
      <h1 className="text-[clamp(1.375rem,1.2rem+0.8vw,1.75rem)] font-semibold tracking-tight break-words">
        {title}
      </h1>
      {description && <p className="mt-1.5 text-sm break-words text-muted-foreground md:text-base">{description}</p>}
      {children && <div className="mt-6">{children}</div>}
    </section>
  );
}

export function AuthCardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4 rounded-xl border bg-card p-5 shadow-sm sm:p-8">
      <Skeleton className="h-8 w-48 max-w-full" />
      <Skeleton className="h-5 w-72 max-w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
