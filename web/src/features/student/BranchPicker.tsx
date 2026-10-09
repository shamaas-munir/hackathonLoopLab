"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Building2, Info, MapPin, Phone, Search } from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { StudentStepper } from "@/components/layout/StudentStepper";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import { studentKeys, useBranches, useProfile, type Branch } from "./api";
import { StickyActionBar } from "./StickyActionBar";
import { useStudentGuard } from "./useStudentGuard";

export function BranchPicker() {
  const { allowed, flow, error, retry } = useStudentGuard("select-branch");
  const branches = useBranches();
  const profile = useProfile();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // On an approved change the current branch starts preselected.
  const selectedId = picked ?? profile.data?.branch?.id ?? "";
  const selected = branches.data?.find((b) => b.id === selectedId);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return branches.data ?? [];
    return (branches.data ?? []).filter((b) =>
      [b.name, b.code, b.city, b.address].some((v) => v.toLowerCase().includes(term)),
    );
  }, [branches.data, search]);

  async function confirm() {
    await apiPost<Branch>("/me/branch/", { branch: selectedId });
    toast.success(`Exam branch set to ${selected?.name}.`);
    // Fresh flow state sends the guard to the next step.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["me"] }),
      queryClient.invalidateQueries({ queryKey: studentKeys.all }),
    ]);
  }

  if (error) return <ErrorState onRetry={() => void retry()} />;
  if (!allowed || branches.isPending) return <PageSkeleton />;
  if (branches.isError) return <ErrorState onRetry={() => void branches.refetch()} />;

  return (
    <>
      <StudentStepper current={1} />
      <PageHeader
        title="Where will you sit your exams?"
        description="Choose the campus for all of your exams."
      />

      {flow?.branch_unlocked && (
        <div
          role="status"
          className="mb-6 flex gap-3 rounded-xl border border-primary/25 bg-primary-soft p-4 text-sm"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p>Your branch change was approved. Choose your new branch. This works once.</p>
        </div>
      )}

      <div className="relative mb-4 max-w-md">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, city or code"
          aria-label="Search branches"
          className="h-11 pl-9 text-base md:h-9 md:text-sm"
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No branches found"
          description={search ? "Try a different search." : "No exam branches are open yet."}
          action={
            search ? (
              <Button variant="outline" onClick={() => setSearch("")}>
                Clear search
              </Button>
            ) : undefined
          }
        />
      ) : (
        <RadioGroupPrimitive.Root
          value={selectedId}
          onValueChange={setPicked}
          aria-label="Exam branch"
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {visible.map((branch) => (
            <BranchCard key={branch.id} branch={branch} checked={branch.id === selectedId} />
          ))}
        </RadioGroupPrimitive.Root>
      )}

      <StickyActionBar>
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {selected ? (
            <>
              Selected: <span className="font-medium text-foreground">{selected.name}</span>
            </>
          ) : (
            "Select a branch to continue."
          )}
        </p>
        <Button size="lg" disabled={!selected} onClick={() => setConfirmOpen(true)}>
          Confirm branch
        </Button>
      </StickyActionBar>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Sit your exams at ${selected?.name ?? "this branch"}?`}
        description="You can choose your exam branch only once. To change it later you will need an approved request from Need Help."
        confirmText="Confirm branch"
        onConfirm={confirm}
      />
    </>
  );
}

function BranchCard({ branch, checked }: { branch: Branch; checked: boolean }) {
  return (
    <RadioGroupPrimitive.Item
      value={branch.id}
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-xl border bg-card p-4 text-left shadow-sm transition-colors outline-none hover:border-primary/50 focus-visible:ring-3 focus-visible:ring-ring/50",
        checked && "border-primary ring-2 ring-primary/40",
      )}
    >
      <span className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="block font-medium break-words">{branch.name}</span>
          <span className="mt-1 inline-flex rounded-md bg-primary-soft px-1.5 py-0.5 text-xs font-medium text-primary">
            {branch.code}
          </span>
        </span>
        <span
          aria-hidden
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
            checked && "border-primary",
          )}
        >
          {checked && <span className="size-2.5 rounded-full bg-primary" />}
        </span>
      </span>
      <span className="flex items-start gap-2 text-sm text-muted-foreground">
        <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="min-w-0 break-words">
          {branch.address}, {branch.city}
        </span>
      </span>
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Phone className="size-4 shrink-0" aria-hidden />
        {branch.contact_number}
      </span>
    </RadioGroupPrimitive.Item>
  );
}
