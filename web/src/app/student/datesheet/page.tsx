import type { Metadata } from "next";
import { DateSheetView } from "@/features/student/DateSheetView";

export const metadata: Metadata = { title: "Date sheet" };

export default function DateSheetPage() {
  return <DateSheetView />;
}
