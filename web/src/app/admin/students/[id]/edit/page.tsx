import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { EditStudent } from "@/features/students/EditStudent";

export const metadata: Metadata = { title: "Edit student" };

export default function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <PageHeader title="Edit student" />
      <Suspense fallback={<PageSkeleton />}>
        <EditStudent params={params} />
      </Suspense>
    </>
  );
}
