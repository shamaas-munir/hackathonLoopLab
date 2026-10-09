import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { StudentDetailView } from "@/features/students/StudentDetailView";

export const metadata: Metadata = { title: "Student details" };

export default function StudentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StudentDetailView params={params} />
    </Suspense>
  );
}
