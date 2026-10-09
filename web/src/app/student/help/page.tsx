import type { Metadata } from "next";
import { NeedHelp } from "@/features/student/NeedHelp";

export const metadata: Metadata = { title: "Need help" };

export default function NeedHelpPage() {
  return <NeedHelp />;
}
