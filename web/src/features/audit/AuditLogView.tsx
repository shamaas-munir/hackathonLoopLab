"use client";

import { CircleCheck, CircleX, Pencil, Plus, Trash2, type LucideIcon } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/data-table/DataTable";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

type AuditEntry = {
  id: number;
  created_at: string;
  actor: string | null;
  action: "create" | "update" | "delete" | "approve" | "reject";
  entity: string;
  entity_id: string;
  label: string;
  details: Record<string, unknown>;
};

const ACTIONS: Record<AuditEntry["action"], { label: string; icon: LucideIcon; className: string }> = {
  create: { label: "Created", icon: Plus, className: "[&>svg]:text-primary" },
  update: { label: "Updated", icon: Pencil, className: "[&>svg]:text-sky" },
  delete: { label: "Deleted", icon: Trash2, className: "[&>svg]:text-danger" },
  approve: { label: "Approved", icon: CircleCheck, className: "[&>svg]:text-success" },
  reject: { label: "Rejected", icon: CircleX, className: "[&>svg]:text-danger" },
};

const ENTITIES: Record<string, string> = {
  branch: "Branch",
  course: "Course",
  student: "Student",
  courseassignment: "Assignment",
  examslot: "Exam slot",
  changerequest: "Request",
};

function ActionBadge({ action }: { action: AuditEntry["action"] }) {
  const { label, icon: Icon, className } = ACTIONS[action] ?? ACTIONS.update;
  return (
    <Badge variant="outline" className={className}>
      <Icon aria-hidden />
      {label}
    </Badge>
  );
}

function Details({ details }: { details: AuditEntry["details"] }) {
  if (Object.keys(details).length === 0) return <span className="text-muted-foreground">-</span>;
  return (
    <details className="max-w-full text-left">
      <summary className="cursor-pointer text-sm text-primary select-none">Show details</summary>
      <pre className="mt-2 max-h-60 max-w-xs overflow-auto rounded-lg bg-muted p-2 text-xs break-words whitespace-pre-wrap sm:max-w-sm">
        {JSON.stringify(details, null, 2)}
      </pre>
    </details>
  );
}

const columns: DataTableColumn<AuditEntry>[] = [
  {
    id: "created_at",
    header: "Time",
    sortField: "created_at",
    cell: (e) => <span className="whitespace-nowrap">{formatDateTime(e.created_at)}</span>,
  },
  { id: "actor", header: "Admin", cell: (e) => <span className="break-all">{e.actor ?? "System"}</span> },
  { id: "action", header: "Action", cell: (e) => <ActionBadge action={e.action} /> },
  { id: "entity", header: "Entity", cell: (e) => ENTITIES[e.entity] ?? e.entity },
  { id: "label", header: "Label", className: "max-w-64", cell: (e) => <span className="break-words">{e.label}</span> },
  { id: "details", header: "Details", cell: (e) => <Details details={e.details} /> },
];

export function AuditLogView() {
  return (
    <DataTable
      queryKey={["audit-log"]}
      endpoint="/admin/audit-log/"
      columns={columns}
      mobileCard={(e) => (
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <ActionBadge action={e.action} />
            <span className="font-medium">{ENTITIES[e.entity] ?? e.entity}</span>
          </div>
          <p className="break-words">{e.label}</p>
          <p className="text-muted-foreground">
            {formatDateTime(e.created_at)} · <span className="break-all">{e.actor ?? "System"}</span>
          </p>
          <Details details={e.details} />
        </div>
      )}
      filters={[
        {
          id: "action",
          label: "Actions",
          options: Object.entries(ACTIONS).map(([value, { label }]) => ({ value, label })),
        },
        {
          id: "entity",
          label: "Entities",
          options: Object.entries(ENTITIES).map(([value, label]) => ({ value, label })),
        },
      ]}
      searchPlaceholder="Search label, details or admin"
      emptyText="No admin actions recorded yet"
      defaultOrdering="-created_at"
    />
  );
}
