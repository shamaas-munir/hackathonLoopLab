import {
  Ban,
  CircleCheck,
  CircleDashed,
  CircleDot,
  CircleMinus,
  CircleX,
  Clock,
  Lock,
  Mail,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type Status =
  | "active"
  | "inactive"
  | "pending"
  | "approved"
  | "rejected"
  | "saved"
  | "not_saved"
  | "incomplete"
  | "complete"
  | "ready"
  | "locked"
  | "full"
  | "invited";

// Text stays in the foreground colour for AA contrast; the tint and icon carry the status colour.
const TONES = {
  success: "border-success/30 bg-success/10 [&>svg]:text-success",
  warning: "border-warning/35 bg-warning/10 [&>svg]:text-warning",
  danger: "border-danger/30 bg-danger/10 [&>svg]:text-danger",
  info: "border-primary/25 bg-primary-soft [&>svg]:text-primary",
  neutral: "border-border bg-muted [&>svg]:text-muted-foreground",
} as const;

const STATUSES: Record<Status, { label: string; icon: LucideIcon; tone: keyof typeof TONES }> = {
  active: { label: "Active", icon: CircleCheck, tone: "success" },
  inactive: { label: "Inactive", icon: CircleMinus, tone: "neutral" },
  pending: { label: "Pending", icon: Clock, tone: "warning" },
  approved: { label: "Approved", icon: CircleCheck, tone: "success" },
  rejected: { label: "Rejected", icon: CircleX, tone: "danger" },
  saved: { label: "Saved", icon: CircleCheck, tone: "success" },
  not_saved: { label: "Not saved", icon: CircleDashed, tone: "neutral" },
  incomplete: { label: "Incomplete", icon: TriangleAlert, tone: "warning" },
  complete: { label: "Complete", icon: CircleCheck, tone: "success" },
  ready: { label: "Ready", icon: CircleDot, tone: "info" },
  locked: { label: "Locked", icon: Lock, tone: "neutral" },
  full: { label: "Full", icon: Ban, tone: "danger" },
  invited: { label: "Invited", icon: Mail, tone: "info" },
};

type StatusBadgeProps = { status: Status; label?: string; className?: string };

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const { label: defaultLabel, icon: Icon, tone } = STATUSES[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap text-foreground",
        TONES[tone],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label ?? defaultLabel}
    </span>
  );
}
