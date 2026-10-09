import { StatusBadge } from "@/components/shared/StatusBadge";
import { isAssignmentComplete, MAX_COURSES, type StudentRow } from "./api";

export function StudentStatusBadges({ row }: { row: Pick<StudentRow, "datesheet_saved_at" | "account_status"> }) {
  return (
    <>
      <StatusBadge status={row.datesheet_saved_at ? "saved" : "not_saved"} />
      {row.account_status === "invited" ? (
        <StatusBadge status="invited" label="Invite pending" />
      ) : (
        <StatusBadge status="active" />
      )}
    </>
  );
}

export function CourseCount({ count }: { count: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular-nums">
        {count}/{MAX_COURSES}
      </span>
      {!isAssignmentComplete(count) && <StatusBadge status="incomplete" />}
    </span>
  );
}
