import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/PageHeader";
import { StudentForm } from "@/features/students/StudentForm";

export const metadata: Metadata = { title: "Add student" };

export default function NewStudentPage() {
  return (
    <>
      <PageHeader
        title="Add student"
        description="The student gets an email with a secure link to set their password."
      />
      <StudentForm />
    </>
  );
}
