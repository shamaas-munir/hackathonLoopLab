import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Branch", "Select slots", "Date sheet"] as const;

/** Progress through the student flow. `current` is 1-based. */
export function StudentStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol aria-label="Progress" className="no-print mb-6 flex items-center gap-2">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={cn("flex min-w-0 items-center gap-2", i > 0 && "flex-1")}
          >
            {i > 0 && (
              <span
                aria-hidden
                className={cn("h-px min-w-4 flex-1", done || active ? "bg-primary" : "bg-border")}
              />
            )}
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                done && "border-primary bg-primary text-primary-foreground",
                active && "border-primary bg-primary-soft text-primary",
                !done && !active && "bg-card text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : step}
            </span>
            <span
              className={cn(
                "truncate text-sm",
                active ? "font-medium text-foreground" : "text-muted-foreground max-sm:sr-only",
              )}
            >
              {label}
              {done && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
