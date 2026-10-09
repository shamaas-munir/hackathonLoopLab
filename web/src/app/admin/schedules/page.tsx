import type { Metadata } from "next";
import { SlotsView } from "@/features/schedules/SlotsView";

export const metadata: Metadata = { title: "Exam slots" };

export default function ExamSlotsPage() {
  return <SlotsView />;
}
