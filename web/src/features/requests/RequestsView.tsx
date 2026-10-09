"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, CalendarClock } from "lucide-react";
import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { pendingRequestsKey } from "@/components/layout/AdminNav";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiGet, type Paginated } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { ReviewSheet } from "./ReviewSheet";
import { requestsKey, type ChangeRequest } from "./types";

function TypeBadge({ request }: { request: ChangeRequest }) {
  const Icon = request.type === "change_branch" ? Building2 : CalendarClock;
  return (
    <Badge variant="outline">
      <Icon aria-hidden />
      {request.type_label}
    </Badge>
  );
}

function usePendingCount() {
  // Same key and request as the sidebar badge, so both share one cached query.
  const { data } = useQuery({
    queryKey: pendingRequestsKey,
    queryFn: () => apiGet<Paginated<unknown>>("/admin/requests/?status=pending&page_size=5"),
  });
  return data?.count;
}

export function RequestsView() {
  const [reviewing, setReviewing] = useState<string | null>(null);
  const pending = usePendingCount();

  const columns: DataTableColumn<ChangeRequest>[] = [
    {
      id: "student",
      header: "Student",
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-medium break-words">{r.student.full_name}</p>
          <p className="text-sm text-muted-foreground">{r.student.registration_no}</p>
        </div>
      ),
    },
    { id: "type", header: "Type", cell: (r) => <TypeBadge request={r} /> },
    {
      id: "reason",
      header: "Reason",
      className: "max-w-64",
      cell: (r) => <p className="line-clamp-2 break-words text-muted-foreground">{r.reason}</p>,
    },
    { id: "created_at", header: "Raised on", sortField: "created_at", cell: (r) => formatDate(r.created_at) },
    { id: "status", header: "Status", sortField: "status", cell: (r) => <StatusBadge status={r.status} /> },
    {
      id: "remark",
      header: "Remark",
      hideBelow: "lg",
      className: "max-w-48",
      cell: (r) => <p className="line-clamp-2 break-words text-muted-foreground">{r.admin_remark || "-"}</p>,
    },
    {
      id: "review",
      header: "",
      className: "text-right",
      cell: (r) => (
        <Button variant={r.status === "pending" ? "default" : "outline"} size="sm" onClick={() => setReviewing(r.id)}>
          {r.status === "pending" ? "Review" : "View"}
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        queryKey={[...requestsKey, "list"]}
        endpoint="/admin/requests/"
        columns={columns}
        mobileCard={(r) => (
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium break-words">{r.student.full_name}</p>
                <p className="text-sm text-muted-foreground">{r.student.registration_no}</p>
              </div>
              <StatusBadge status={r.status} />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <TypeBadge request={r} />
              <span className="text-muted-foreground">Raised {formatDate(r.created_at)}</span>
            </div>
            <p className="line-clamp-2 text-sm break-words text-muted-foreground">{r.reason}</p>
            <Button
              variant={r.status === "pending" ? "default" : "outline"}
              className="w-full"
              onClick={() => setReviewing(r.id)}
            >
              {r.status === "pending" ? "Review" : "View decision"}
            </Button>
          </div>
        )}
        filters={[
          {
            id: "status",
            label: "Statuses",
            options: [
              { value: "pending", label: pending ? `Pending (${pending})` : "Pending" },
              { value: "approved", label: "Approved" },
              { value: "rejected", label: "Rejected" },
            ],
          },
          {
            id: "type",
            label: "Types",
            options: [
              { value: "change_branch", label: "Change branch" },
              { value: "change_datesheet", label: "Change date sheet" },
            ],
          },
        ]}
        filtersAs="tabs"
        searchPlaceholder="Search student, reg no or reason"
        emptyText="No requests found"
        defaultOrdering="-created_at"
      />
      <ReviewSheet requestId={reviewing} onClose={() => setReviewing(null)} />
    </>
  );
}
