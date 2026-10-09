import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/PageHeader";
import { CoursesView } from "@/features/courses/CoursesView";

export const metadata: Metadata = { title: "Courses" };

export default function CoursesPage() {
  return (
    <>
      <PageHeader title="Courses" description="Courses that can be assigned and scheduled." />
      <CoursesView />
    </>
  );
}
