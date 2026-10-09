import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/PageHeader";
import { RequestsView } from "@/features/requests/RequestsView";

export const metadata: Metadata = { title: "Requests" };

export default function RequestsPage() {
  return (
    <>
      <PageHeader
        title="Requests"
        description="Branch and date sheet change requests from students. Approving unlocks the change once."
      />
      <RequestsView />
    </>
  );
}
