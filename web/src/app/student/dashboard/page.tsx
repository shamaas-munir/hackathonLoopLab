import type { Metadata } from "next";
import { StudentDashboard } from "@/features/student/StudentDashboard";

export const metadata: Metadata = { title: "My date sheet" };

export default function MyDateSheetPage() {
  return <StudentDashboard />;
}
