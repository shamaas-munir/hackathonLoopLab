const TZ = "Asia/Karachi";
const THREE_HOURS = 3 * 60 * 60 * 1000;

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long" });
const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour: "numeric",
  minute: "2-digit",
});

type DateInput = string | number | Date;

/** "14 Oct 2026" */
export const formatDate = (value: DateInput) => dateFmt.format(new Date(value));

/** "Wednesday" */
export const formatDay = (value: DateInput) => dayFmt.format(new Date(value));

/** "9:00 AM - 12:00 PM". A missing end means start + 3 hours (D5). */
export function formatTimeRange(start: DateInput, end?: DateInput | null) {
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date(startDate.getTime() + THREE_HOURS);
  return `${timeFmt.format(startDate)} - ${timeFmt.format(endDate)}`;
}

/** "14 Oct 2026, 9:00 AM" */
export const formatDateTime = (value: DateInput) =>
  `${formatDate(value)}, ${timeFmt.format(new Date(value))}`;
