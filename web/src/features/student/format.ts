import { formatTimeRange } from "@/lib/format";

const shortDateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Karachi",
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** "Mon, 12 Oct" */
export const formatShortDate = (value: string) => shortDateFmt.format(new Date(value));

/** "Mon, 12 Oct, 9:00 AM - 12:00 PM" */
export const formatSlot = (start: string, end: string) =>
  `${formatShortDate(start)}, ${formatTimeRange(start, end)}`;

export const REQUEST_LABELS = {
  change_branch: "Change branch",
  change_datesheet: "Change date sheet",
} as const;
