"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorState } from "@/components/shared/ErrorState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import { formatDate, formatDateTime, formatDay, formatTimeRange } from "@/lib/format";
import { requestsKey, type ChangeRequestDetail } from "./types";

const REMARK_MAX = 500;
type Decision = "approve" | "reject";

const DECISION_COPY: Record<Decision, { title: string; done: string }> = {
  approve: { title: "Approve this request?", done: "Request approved" },
  reject: { title: "Reject this request?", done: "Request rejected" },
};

function unlockText(request: ChangeRequestDetail) {
  return request.type === "change_branch"
    ? `${request.student.full_name} will be able to choose a new branch once.`
    : `${request.student.full_name} will be able to change and save the date sheet once.`;
}

type ReviewSheetProps = { requestId: string | null; onClose: () => void };

export function ReviewSheet({ requestId, onClose }: ReviewSheetProps) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  return (
    <Sheet open={requestId !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        className="max-h-[92dvh] gap-0 data-[side=bottom]:rounded-t-2xl data-[side=right]:w-full data-[side=right]:sm:max-w-md"
      >
        {requestId && <ReviewBody key={requestId} requestId={requestId} onClose={onClose} />}
      </SheetContent>
    </Sheet>
  );
}

function ReviewBody({ requestId, onClose }: { requestId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [remark, setRemark] = useState("");
  const [confirming, setConfirming] = useState<Decision | null>(null);
  const query = useQuery({
    queryKey: [...requestsKey, "detail", requestId],
    queryFn: () => apiGet<ChangeRequestDetail>(`/admin/requests/${requestId}/`),
  });
  const request = query.data;

  async function decide(decision: Decision) {
    try {
      await apiPost(`/admin/requests/${requestId}/${decision}/`, { remark: remark.trim() });
    } catch (err) {
      // Another admin got there first: show the current state.
      if (err instanceof ApiError && err.status === 409) void queryClient.invalidateQueries({ queryKey: requestsKey });
      throw err;
    }
    toast.success(`${DECISION_COPY[decision].done}. ${request?.student.full_name} has been emailed.`);
    await queryClient.invalidateQueries({ queryKey: requestsKey });
    onClose();
  }

  return (
    <>
      <SheetHeader className="border-b pr-12 text-left">
        <SheetTitle>Review request</SheetTitle>
        <SheetDescription>{request ? request.type_label : "Loading request"}</SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : !request ? (
          <div className="space-y-3" aria-hidden>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <>
            <section className="space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base font-semibold break-words">{request.student.full_name}</p>
                <StatusBadge status={request.status} />
              </div>
              <p className="text-muted-foreground">
                {request.student.registration_no} · <span className="break-all">{request.student.email}</span>
              </p>
              <p className="text-muted-foreground">Raised on {formatDateTime(request.created_at)}</p>
            </section>

            <section className="space-y-1.5">
              <h3 className="font-medium">Reason</h3>
              <p className="rounded-lg bg-muted p-3 break-words whitespace-pre-wrap">{request.reason}</p>
            </section>

            <section className="space-y-1.5">
              <h3 className="font-medium">Current branch</h3>
              <p className="text-muted-foreground">
                {request.student.branch
                  ? `${request.student.branch}${request.branch_city ? `, ${request.branch_city}` : ""}`
                  : "No branch selected yet"}
              </p>
            </section>

            <section className="space-y-1.5">
              <h3 className="font-medium">Current date sheet</h3>
              {request.datesheet.length === 0 ? (
                <p className="text-muted-foreground">No date sheet saved yet.</p>
              ) : (
                <ul className="divide-y rounded-lg border">
                  {request.datesheet.map((row) => (
                    <li key={row.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1 p-3">
                      <span className="min-w-0">
                        <span className="font-medium">{row.course_code}</span>{" "}
                        <span className="text-muted-foreground">{row.course_title}</span>
                      </span>
                      <span className="text-muted-foreground">
                        {formatDay(row.start_at).slice(0, 3)} {formatDate(row.start_at)},{" "}
                        {formatTimeRange(row.start_at, row.end_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {request.status === "pending" ? (
              <section className="space-y-1.5">
                <Label htmlFor="remark">Remark for the student (optional)</Label>
                <Textarea
                  id="remark"
                  value={remark}
                  maxLength={REMARK_MAX}
                  onChange={(e) => setRemark(e.target.value)}
                  placeholder="This is included in the email to the student."
                  className="min-h-24"
                  aria-describedby="remark-count"
                />
                <p id="remark-count" className="text-right text-xs text-muted-foreground">
                  {remark.length} / {REMARK_MAX}
                </p>
              </section>
            ) : (
              <section className="space-y-1.5 rounded-lg border p-3">
                <h3 className="font-medium">Decision</h3>
                <p className="text-muted-foreground">
                  {request.status === "approved" ? "Approved" : "Rejected"}
                  {request.reviewed_by && ` by ${request.reviewed_by}`}
                  {request.reviewed_at && ` on ${formatDateTime(request.reviewed_at)}`}
                </p>
                <p className="break-words whitespace-pre-wrap">{request.admin_remark || "No remark."}</p>
              </section>
            )}
          </>
        )}
      </div>

      {request?.status === "pending" && (
        <SheetFooter className="flex-row border-t pb-[max(1rem,env(safe-area-inset-bottom))] [&>*]:flex-1">
          <Button variant="destructive" onClick={() => setConfirming("reject")}>
            <X aria-hidden /> Reject
          </Button>
          <Button className="bg-success text-white hover:bg-success/90 dark:text-background" onClick={() => setConfirming("approve")}>
            <Check aria-hidden /> Approve
          </Button>
        </SheetFooter>
      )}

      {request && (
        <ConfirmDialog
          open={confirming !== null}
          onOpenChange={(open) => !open && setConfirming(null)}
          title={confirming ? DECISION_COPY[confirming].title : ""}
          description={
            confirming === "approve"
              ? `${unlockText(request)} They will get an email with your remark.`
              : "Nothing changes for the student. They will get an email with your remark."
          }
          confirmText={confirming === "approve" ? "Approve" : "Reject"}
          destructive={confirming === "reject"}
          onConfirm={() => decide(confirming!)}
        />
      )}
    </>
  );
}
