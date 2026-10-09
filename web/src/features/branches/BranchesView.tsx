"use client";

import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { DataTable, useInvalidateList, type DataTableColumn } from "@/components/data-table/DataTable";
import { ApiError, apiDelete, apiPost } from "@/lib/api";
import { BranchFormDialog, type Branch } from "./BranchFormDialog";
import { STATUS_OPTIONS } from "./StatusSelect";

const QUERY_KEY = ["branches"] as const;

const columns: DataTableColumn<Branch>[] = [
  {
    id: "name",
    header: "Name",
    sortField: "name",
    cell: (b) => <span className="font-medium">{b.name}</span>,
  },
  { id: "code", header: "Code", sortField: "code", cell: (b) => b.code },
  { id: "city", header: "City", sortField: "city", cell: (b) => b.city },
  { id: "contact", header: "Contact", cell: (b) => b.contact_number, hideBelow: "lg" },
  {
    id: "students",
    header: "Students",
    sortField: "students_count",
    cell: (b) => <span className="tabular-nums">{b.students_count}</span>,
  },
  { id: "status", header: "Status", cell: (b) => <StatusBadge status={b.status ?? "active"} /> },
];

function mobileCard(b: Branch) {
  return (
    <div className="space-y-2">
      <div className="min-w-0">
        <p className="font-medium break-words">{b.name}</p>
        <p className="text-sm text-muted-foreground">
          {b.code} · {b.city}
        </p>
      </div>
      <p className="text-sm break-words">{b.contact_number}</p>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StatusBadge status={b.status ?? "active"} />
        <span className="text-muted-foreground">
          {b.students_count} {b.students_count === 1 ? "student" : "students"}
        </span>
      </div>
    </div>
  );
}

export function BranchesView() {
  const refresh = useInvalidateList(QUERY_KEY);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Branch | null>(null);
  const [inUse, setInUse] = useState<{ branch: Branch; message: string } | null>(null);

  const openForm = (branch: Branch | null) => {
    setEditing(branch);
    setFormOpen(true);
  };

  async function toggleStatus(branch: Branch) {
    try {
      const updated = await apiPost<Branch>(`/admin/branches/${branch.id}/toggle-status/`);
      toast.success(`${updated.name} is now ${updated.status}.`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not change the status.");
    }
  }

  async function deleteBranch() {
    if (!deleting) return;
    try {
      await apiDelete(`/admin/branches/${deleting.id}/`);
      toast.success(`${deleting.name} deleted.`);
      await refresh();
    } catch (err) {
      if (!(err instanceof ApiError && err.code === "IN_USE")) throw err;
      if (deleting.status === "active") setInUse({ branch: deleting, message: err.message });
      else toast.error(err.message);
    }
  }

  return (
    <>
      <DataTable
        queryKey={QUERY_KEY}
        endpoint="/admin/branches/"
        columns={columns}
        mobileCard={mobileCard}
        filters={[{ id: "status", label: "Statuses", options: STATUS_OPTIONS }]}
        searchPlaceholder="Search name, code or city"
        emptyText="No branches yet"
        toolbarActions={
          <Button onClick={() => openForm(null)}>
            <Plus aria-hidden />
            Add branch
          </Button>
        }
        rowActions={(b) => [
          { label: "Edit", icon: Pencil, onSelect: () => openForm(b) },
          {
            label: b.status === "active" ? "Deactivate" : "Activate",
            icon: Power,
            onSelect: () => void toggleStatus(b),
          },
          { label: "Delete", icon: Trash2, destructive: true, onSelect: () => setDeleting(b) },
        ]}
      />

      <BranchFormDialog open={formOpen} onOpenChange={setFormOpen} branch={editing} onSaved={refresh} />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete branch?"
        description={`Delete ${deleting?.name}? This cannot be undone.`}
        confirmText="Delete"
        destructive
        onConfirm={deleteBranch}
      />

      <ConfirmDialog
        open={inUse !== null}
        onOpenChange={(open) => !open && setInUse(null)}
        title="Can't delete this branch"
        description={`${inUse?.message ?? ""} Inactive branches are hidden from new selections, and students who chose it keep it.`}
        confirmText="Mark inactive"
        onConfirm={async () => {
          if (inUse) await toggleStatus(inUse.branch);
        }}
      />
    </>
  );
}
