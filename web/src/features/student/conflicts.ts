import type { CourseSlots, SlotOption } from "./api";
import { formatSlot } from "./format";

export type Conflict = { courseIds: [string, string]; message: string };

/** Same rule as the server (D6): overlap when startA < endB and startB < endA; back-to-back is fine. */
export function findConflicts(courses: CourseSlots[], chosen: Record<string, SlotOption>): Conflict[] {
  const picked = courses
    .filter(({ course }) => chosen[course.id])
    .map(({ course }) => ({ course, slot: chosen[course.id] }))
    .sort((a, b) => Date.parse(a.slot.start_at) - Date.parse(b.slot.start_at));

  const conflicts: Conflict[] = [];
  picked.forEach((a, i) => {
    for (const b of picked.slice(i + 1)) {
      const overlap =
        Date.parse(a.slot.start_at) < Date.parse(b.slot.end_at) &&
        Date.parse(b.slot.start_at) < Date.parse(a.slot.end_at);
      if (overlap) {
        conflicts.push({
          courseIds: [a.course.id, b.course.id],
          message: `${a.course.code} and ${b.course.code} overlap on ${formatSlot(a.slot.start_at, a.slot.end_at)}`,
        });
      }
    }
  });
  return conflicts;
}
