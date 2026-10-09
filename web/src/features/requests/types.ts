export type RequestStatus = "pending" | "approved" | "rejected";
export type RequestType = "change_branch" | "change_datesheet";

export type ChangeRequest = {
  id: string;
  student: {
    id: string;
    full_name: string;
    registration_no: string;
    email: string;
    branch: string | null;
  };
  type: RequestType;
  type_label: string;
  reason: string;
  status: RequestStatus;
  admin_remark: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export type ChangeRequestDetail = ChangeRequest & {
  branch_city: string | null;
  datesheet_saved_at: string | null;
  datesheet: {
    id: number;
    course_code: string;
    course_title: string;
    start_at: string;
    end_at: string | null;
  }[];
};

/** Invalidating this prefix also refreshes the sidebar pending badge (["requests", "pending-count"]). */
export const requestsKey = ["requests"] as const;
