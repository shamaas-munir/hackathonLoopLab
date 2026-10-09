"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ChevronRight, Inbox, MapPin, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { FormField } from "@/components/shared/FormField";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { ResponsiveDialog } from "@/components/shared/ResponsiveDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, apiPost, applyFieldErrors } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { studentKeys, useRequests, type ChangeRequest, type RequestType } from "./api";
import { REQUEST_LABELS } from "./format";
import { useStudentGuard } from "./useStudentGuard";

const MAX_REASON = 500;

type Option = {
  type: RequestType;
  icon: LucideIcon;
  description: string;
  disabledReason: string | null;
  /** Where to make the change once the matching request is approved. */
  action: { href: string; label: string } | null;
};

export function NeedHelp() {
  const { flow, allowed, error, retry } = useStudentGuard("help");
  const requests = useRequests();
  const [dialogType, setDialogType] = useState<RequestType | null>(null);

  if (error) return <ErrorState onRetry={() => void retry()} />;
  if (!allowed || !flow || requests.isPending) return <PageSkeleton />;
  if (requests.isError) return <ErrorState onRetry={() => void requests.refetch()} />;

  const pending = new Set(requests.data.filter((r) => r.status === "pending").map((r) => r.type));
  const blocked = (type: RequestType, ready: boolean, notReady: string, unlocked: boolean) =>
    !ready
      ? notReady
      : unlocked
        ? "Your request was approved. Make the change first."
        : pending.has(type)
          ? "You already have a pending request of this type."
          : null;

  const options: Option[] = [
    {
      type: "change_branch",
      icon: MapPin,
      description: "Sit your exams at a different campus.",
      disabledReason: blocked(
        "change_branch",
        flow.has_branch,
        "Select your branch first.",
        flow.branch_unlocked,
      ),
      action: flow.branch_unlocked
        ? { href: "/student/select-branch", label: "Change branch now" }
        : null,
    },
    {
      type: "change_datesheet",
      icon: CalendarClock,
      description: "Pick different dates or times for your exams.",
      disabledReason: blocked(
        "change_datesheet",
        flow.has_saved_datesheet,
        "Save your date sheet first.",
        flow.datesheet_unlocked,
      ),
      action:
        flow.datesheet_unlocked && flow.has_saved_datesheet
          ? { href: "/student/dashboard", label: "Edit date sheet now" }
          : null,
    },
  ];
  const actions = new Map(options.map((o) => [o.type, o.action]));
  // The unlock action belongs on the newest approved request of each type.
  const latestApproved = new Map<RequestType, string>();
  for (const r of requests.data) {
    if (r.status === "approved" && !latestApproved.has(r.type)) latestApproved.set(r.type, r.id);
  }

  return (
    <>
      <PageHeader
        title="Need help"
        description="Ask the administration to change your branch or date sheet."
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <OptionCard key={option.type} option={option} onSelect={() => setDialogType(option.type)} />
        ))}
      </div>

      <h2 className="mb-3 text-lg font-semibold">My requests</h2>
      {requests.data.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No requests yet"
          description="Requests you raise will show here with their status."
        />
      ) : (
        <ul className="grid gap-3">
          {requests.data.map((request) => (
            <RequestItem
              key={request.id}
              request={request}
              action={latestApproved.get(request.type) === request.id ? actions.get(request.type) : null}
            />
          ))}
        </ul>
      )}

      <RequestDialog type={dialogType} onClose={() => setDialogType(null)} />
    </>
  );
}

function OptionCard({ option, onSelect }: { option: Option; onSelect: () => void }) {
  const { icon: Icon, disabledReason, action } = option;
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="font-medium">{REQUEST_LABELS[option.type]}</p>
          <p className="text-sm text-muted-foreground">{option.description}</p>
        </div>
      </div>
      {disabledReason && <p className="text-sm text-muted-foreground">{disabledReason}</p>}
      {action ? (
        <Button asChild className="mt-auto w-full sm:w-fit">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : (
        <Button
          variant="outline"
          className="mt-auto w-full sm:w-fit"
          disabled={Boolean(disabledReason)}
          onClick={onSelect}
        >
          Raise request
          <ChevronRight aria-hidden />
        </Button>
      )}
    </div>
  );
}

function RequestItem({
  request,
  action,
}: {
  request: ChangeRequest;
  action: Option["action"] | undefined;
}) {
  const rejected = request.status === "rejected";
  return (
    <li className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{REQUEST_LABELS[request.type]}</p>
        <StatusBadge status={request.status} />
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Raised {formatDateTime(request.created_at)}
      </p>
      <p className="mt-2 text-sm break-words whitespace-pre-line">{request.reason}</p>
      {request.admin_remark && (
        <div
          className={cn(
            "mt-3 rounded-lg border p-3 text-sm",
            rejected ? "border-danger/30 bg-danger/10" : "bg-muted",
          )}
        >
          <p className="text-xs font-medium text-muted-foreground">Admin remark</p>
          <p className="break-words whitespace-pre-line">{request.admin_remark}</p>
        </div>
      )}
      {action && (
        <Button asChild className="mt-3 w-full sm:w-fit">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </li>
  );
}

const schema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Please explain in at least 10 characters.")
    .max(MAX_REASON, `Keep the reason under ${MAX_REASON} characters.`),
});
type Values = z.infer<typeof schema>;

function RequestDialog({ type, onClose }: { type: RequestType | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { reason: "" } });
  const length = useWatch({ control: form.control, name: "reason" }).length;

  function close() {
    form.reset();
    onClose();
  }

  async function onSubmit(values: Values) {
    try {
      await apiPost<ChangeRequest>("/me/requests/", { type, reason: values.reason });
      toast.success("Request sent. The administration will review it.");
      void queryClient.invalidateQueries({ queryKey: studentKeys.requests });
      close();
    } catch (err) {
      if (!applyFieldErrors(form.setError, err)) {
        toast.error(err instanceof ApiError ? err.message : "Could not send the request.");
      }
    }
  }

  return (
    <ResponsiveDialog
      open={type !== null}
      onOpenChange={(open) => !open && close()}
      title={type ? REQUEST_LABELS[type] : ""}
      description="Tell the administration why you need this change."
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={form.formState.isSubmitting}>
            Cancel
          </Button>
          <LoadingButton
            type="submit"
            form="request-form"
            loading={form.formState.isSubmitting}
          >
            Send request
          </LoadingButton>
        </>
      }
    >
      <form id="request-form" onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <FormField
          control={form.control}
          name="reason"
          label="Reason"
          required
          description={`${length} / ${MAX_REASON} characters, minimum 10`}
        >
          {(field) => (
            <Textarea {...field} rows={5} maxLength={MAX_REASON} className="text-base md:text-sm" />
          )}
        </FormField>
      </form>
    </ResponsiveDialog>
  );
}
