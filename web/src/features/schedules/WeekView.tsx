"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { CalendarX, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { DataTableRowAction } from "@/components/data-table/DataTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, toQueryString, type Paginated } from "@/lib/api";
import { cn } from "@/lib/utils";
import { SlotCapacity, SlotChosen, SlotTime } from "./SlotBits";
import { slotsKey, type Slot } from "./types";

const WEEK_LIMIT = 50;
const iso = (day: Date) => format(day, "yyyy-MM-dd");

/** Slots of one week grouped by date: the default view on phones. */
export function WeekView({ actions }: { actions: (slot: Slot) => DataTableRowAction[] }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const weekEnd = addDays(weekStart, 6);
  const qs = toQueryString({
    date_from: iso(weekStart),
    date_to: iso(weekEnd),
    ordering: "start_at",
    page_size: WEEK_LIMIT,
  });
  const query = useQuery({
    queryKey: [...slotsKey, "week", qs],
    queryFn: () => apiGet<Paginated<Slot>>(`/admin/slots/${qs}`),
    placeholderData: keepPreviousData,
  });

  const days = new Map<string, Slot[]>();
  for (const slot of query.data?.results ?? []) days.set(slot.date, [...(days.get(slot.date) ?? []), slot]);

  return (
    <section aria-label="Week view" className="space-y-4">
      <div className="flex items-center justify-between gap-2 rounded-xl border bg-card p-2 shadow-sm">
        <Button variant="ghost" size="icon" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <ChevronLeft aria-hidden />
        </Button>
        <p className="text-center text-sm font-medium" aria-live="polite">
          {format(weekStart, "d MMM")} to {format(weekEnd, "d MMM yyyy")}
        </p>
        <Button variant="ghost" size="icon" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <ChevronRight aria-hidden />
        </Button>
      </div>

      {query.isError && !query.data ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <div className="space-y-3" aria-hidden>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : days.size === 0 ? (
        <EmptyState icon={CalendarX} title="No exams this week" description="Use the arrows to see other weeks." />
      ) : (
        <div className={cn("space-y-5 transition-opacity", query.isPlaceholderData && "opacity-60")}>
          {[...days].map(([date, slots]) => (
            <div key={date}>
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
                {format(parseISO(date), "EEEE d MMMM")}
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {slots.map((slot) => (
                  <li key={slot.id} className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{slot.course_code}</p>
                      <p className="truncate text-sm text-muted-foreground">{slot.course_title}</p>
                    </div>
                    <p className="text-sm">
                      <SlotTime slot={slot} />
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <SlotCapacity slot={slot} />
                      <SlotChosen slot={slot} />
                    </div>
                    <div className="flex gap-2 [&>*]:flex-1">
                      {actions(slot).map(({ label, icon: Icon, onSelect, disabled, destructive }) => (
                        <Button
                          key={label}
                          variant={destructive ? "destructive" : "outline"}
                          size="sm"
                          disabled={disabled}
                          onClick={onSelect}
                        >
                          {Icon && <Icon aria-hidden />}
                          {label}
                        </Button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {query.data.count > WEEK_LIMIT && (
            <p className="text-sm text-muted-foreground">
              Showing the first {WEEK_LIMIT} of {query.data.count} slots. Use the table view to see them all.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
