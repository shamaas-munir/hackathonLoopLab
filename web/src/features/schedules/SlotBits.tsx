import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatTimeRange } from "@/lib/format";
import type { Slot } from "./types";

export function SlotTime({ slot }: { slot: Slot }) {
  return (
    <span className="whitespace-nowrap">
      {formatTimeRange(slot.start_at, slot.end_at)}
      {!slot.end_at && <span className="text-muted-foreground"> (3 h)</span>}
    </span>
  );
}

export function SlotCapacity({ slot }: { slot: Slot }) {
  if (slot.total_capacity === null) return <span className="text-muted-foreground">Unlimited</span>;
  return (
    <span className="whitespace-nowrap">
      {slot.chosen_count} / {slot.total_capacity}
      <span className="block text-xs text-muted-foreground">{slot.capacity_per_branch} per branch</span>
    </span>
  );
}

export function SlotChosen({ slot }: { slot: Slot }) {
  if (slot.chosen_count === 0) return <span className="text-muted-foreground">Not chosen yet</span>;
  return <StatusBadge status="locked" label={`Chosen by ${slot.chosen_count}`} />;
}
