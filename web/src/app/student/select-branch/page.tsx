import type { Metadata } from "next";
import { BranchPicker } from "@/features/student/BranchPicker";

export const metadata: Metadata = { title: "Select branch" };

export default function SelectBranchPage() {
  return <BranchPicker />;
}
