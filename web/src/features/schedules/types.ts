export type Slot = {
  id: string;
  course: string;
  course_code: string;
  course_title: string;
  /** Local (Asia/Karachi) date, YYYY-MM-DD */
  date: string;
  day: string;
  /** HH:mm, local */
  start_time: string;
  end_time: string | null;
  start_at: string;
  end_at: string | null;
  capacity_per_branch: number | null;
  /** capacity_per_branch x active branches */
  total_capacity: number | null;
  chosen_count: number;
};

export type SlotInput = {
  course: string;
  date: string;
  start_time: string;
  end_time: string | null;
  capacity_per_branch: number | null;
};

export type CourseOption = { id: string; code: string; title: string; status: string };

export const slotsKey = ["slots"] as const;
