"use client";

import { use } from "react";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { ApiError } from "@/lib/api";
import { useStudent } from "./api";
import { StudentForm } from "./StudentForm";

export function EditStudent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const student = useStudent(id);

  if (student.isPending) return <PageSkeleton />;
  if (student.isError) {
    const notFound = student.error instanceof ApiError && student.error.status === 404;
    return (
      <ErrorState
        title={notFound ? "Student not found" : undefined}
        onRetry={notFound ? undefined : () => void student.refetch()}
      />
    );
  }
  // A new version (after "Reload") remounts the form with fresh values.
  return <StudentForm key={student.data.version} student={student.data} />;
}
