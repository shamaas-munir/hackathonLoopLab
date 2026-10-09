import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/PageHeader";
import { StudentsTable } from "@/features/students/StudentsTable";

export const metadata: Metadata = { title: "Students" };

export default function StudentsPage() {
  return (
    <>
      <PageHeader title="Students" description="Student accounts, profiles and progress." />
      <StudentsTable />
    </>
  );
}
