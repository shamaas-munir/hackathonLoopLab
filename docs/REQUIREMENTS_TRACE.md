# Requirements trace

Every requirement line of the Loopverse 3.0 question paper, where it is implemented and how it is enforced.
Paths are relative to the repo root (`backend/apps/...`, web routes under `web/src/app/...`).

**Evidence** is filled in by the integrator after merge: a test name (`apps/x/tests/test_y.py::test_z`), a screenshot in `docs/screenshots/`, or a manual check with date.

Legend for "Enforced by": **DB** = PostgreSQL constraint, **Service** = server-side service/serializer/permission, **UI** = frontend.

## 4.1 Branch management (full CRUD)

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| A-BR-1 | Create, view, update, delete branches | `branches/views.py` (`BranchViewSet`), `/admin/branches` | Service (`IsAdmin`), UI dialogs | `apps/branches/tests/test_branches.py::test_create_uppercases_code_and_audits`<br>`apps/branches/tests/test_branches.py::test_toggle_status`<br>`apps/branches/tests/test_branches.py::test_delete_unused_branch` |
| A-BR-2 | Fields: name, code, city, address, contact number, status | `branches/models.py`, `branches/serializers.py` | DB (`unique_branch_code`), Service (validation), UI (form) | `apps/branches/tests/test_branches.py::test_accepted_contact_numbers`<br>`apps/branches/tests/test_branches.py::test_duplicate_code_is_409_with_field_error` |
| A-BR-3 | Student may sit exams in any **active** branch | `students/me_views.py` (`GET me/branches/`, `POST me/branch/`), `/student/select-branch` | Service (inactive → 422), UI (only active listed) | `apps/students/tests/test_me_branch.py::test_branches_lists_only_active`<br>`apps/students/tests/test_me_branch.py::test_inactive_branch_rejected` |
| A-BR-4 | Branch chosen by students cannot be hard-deleted; choice explained in README | `branches/views.py` `destroy`, README D1 | DB (`PROTECT` on `Student.branch`, `DatesheetSelection.branch`), Service (409 `IN_USE`), UI ("Mark inactive") | `apps/branches/tests/test_branches.py::test_delete_branch_chosen_by_student_is_409`<br>`apps/branches/tests/test_branches.py::test_delete_branch_referenced_only_by_selection_is_409` |

## 4.2 Course management (full CRUD)

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| A-CO-1 | Create, view, update, delete courses | `courses/views.py`, `/admin/courses` | Service, UI | `apps/courses/tests/test_courses.py::test_create_course`<br>`apps/courses/tests/test_courses.py::test_update_course`<br>`apps/courses/tests/test_courses.py::test_delete_unused_course` |
| A-CO-2 | Fields: code (unique), title, credit hours, department, status | `courses/models.py` (`Department` lookup), `courses/serializers.py` | DB (`unique_course_code`, `course_credit_hours_1_6`), Service, UI | `apps/courses/tests/test_courses.py::test_course_validation`<br>`apps/courses/tests/test_courses.py::test_duplicate_course_code_is_409`<br>`apps/courses/tests/test_courses.py::test_department_crud` |

## 4.3 Student management (full CRUD)

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| A-ST-1 | Full CRUD on students | `students/views.py`, `students/services.py`, `/admin/students` | Service, UI | `apps/students/tests/test_admin_students.py::test_create_student_queues_setup_email_and_is_invited`<br>`apps/branches/tests/test_branches.py::test_update_and_retrieve`<br>`apps/students/tests/test_admin_students.py::test_delete_cascades_to_user` |
| A-ST-2 | Personal: full name, email (unique), phone, CNIC/B-Form, DOB, gender, address, photo (optional) | `students/models.py`, `accounts/models.py` (email), `students/serializers.py` | DB (`User.email` unique, `unique_student_cnic`), Service (format, photo type/size) | `apps/students/tests/test_admin_students.py::test_invalid_fields_return_422`<br>`apps/students/tests/test_admin_students.py::test_duplicate_unique_fields_return_409_with_field_errors`<br>`apps/students/tests/test_admin_students.py::test_photo_upload_validates_type_and_size` |
| A-ST-3 | Guardian: name, parent CNIC, occupation, contact, emergency contact | same | Service, UI (form group) | `apps/students/tests/test_admin_students.py::test_invalid_fields_return_422`<br>`apps/students/tests/test_admin_students.py::test_retrieve_includes_assignments_and_flow_data` |
| A-ST-4 | Academic: reg no (unique), program, semester, session, previous qualification, previous institute, marks/CGPA | same, `Program` lookup | DB (`unique_student_registration_no`, `student_semester_1_12`, `student_marks_non_negative`), Service | `apps/students/tests/test_admin_students.py::test_duplicate_unique_fields_return_409_with_field_errors`<br>`apps/students/tests/test_admin_students.py::test_programs_crud_and_delete_blocked_when_used` |
| A-ST-5 | Email sent on create with secure set-password link | `students/services.py` → `accounts/services.py` `send_account_setup_email` → `common/emails.py` outbox, `templates/emails/account_setup.*` | Service (outbox row in the same transaction) | `apps/students/tests/test_admin_students.py::test_create_student_queues_setup_email_and_is_invited`<br>`apps/accounts/tests/test_auth.py::test_setup_email_links_to_set_password_page` |
| A-ST-6 | Link single-use and time-limited (24 h) | `accounts/tokens.py` (`setup_token_generator`, `token_nonce`), `accounts/services.py` | Service (signed token, nonce bump) | `apps/accounts/tests/test_auth.py::test_setup_link_validates_sets_password_and_works_once`<br>`apps/accounts/tests/test_auth.py::test_setup_link_expires_after_24_hours`<br>`apps/accounts/tests/test_auth.py::test_new_link_invalidates_older_link`<br>`apps/accounts/tests/test_auth.py::test_tampered_links_are_invalid` |
| A-ST-7 | Passwords never stored or emailed in plain text | `config/settings.py` (`Argon2PasswordHasher`), email templates | Service | `apps/accounts/tests/test_auth.py::test_set_password_rejects_weak_or_mismatched_passwords` |

## 4.4 Course assignment (full CRUD)

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| A-AS-1 | At least 4, at most 6 courses | `students/services.py` (row lock + count) | Service (422), UI (counter, disabled buttons) | `apps/students/tests/test_admin_assignments.py::test_adding_seventh_course_is_422`<br>`apps/students/tests/test_admin_assignments.py::test_replace_outside_4_to_6_is_422`<br>`apps/students/tests/test_admin_assignments.py::test_remove_at_four_is_422_but_allowed_above_and_below` |
| A-AS-2 | Rule enforced on the server; fewer than 4 shows "assignment incomplete" and cannot proceed | `students/services.py`, `students/state.py` `flow_state`, date sheet endpoints, `/admin/students`, `/student/dashboard` | Service (403 `ASSIGNMENT_INCOMPLETE`), UI (badge, warning card) | `apps/students/tests/test_admin_assignments.py::test_replace_outside_4_to_6_is_422`<br>`apps/scheduling/tests/test_datesheet.py::test_incomplete_assignment_forbidden` |
| A-AS-3 | Same course not assigned twice | `students/models.py` `unique_assignment`, `students/services.py` | DB, Service (409), UI | `apps/students/tests/test_admin_assignments.py::test_duplicate_course_is_409`<br>`apps/students/tests/test_admin_assignments.py::test_replace_with_duplicate_ids_is_422` |
| A-AS-4 | View, change, remove while 4 to 6 valid and no saved date sheet | `students/views.py` (assignments endpoints), `/admin/assignments`, `/admin/students/[id]` | Service, UI | `apps/students/tests/test_admin_assignments.py::test_replace_sets_exact_course_set`<br>`apps/students/tests/test_admin_assignments.py::test_assignment_list_search_filter_and_pagination`<br>`apps/students/tests/test_admin_assignments.py::test_changes_after_saved_datesheet_are_locked` |
| A-AS-5 | Decide and document behaviour after save | `students/services.py` (409 `LOCKED` unless `datesheet_unlocked`), README D3 | Service, UI (disabled with reason) | `apps/students/tests/test_admin_assignments.py::test_changes_after_saved_datesheet_are_locked`<br>`apps/students/tests/test_admin_assignments.py::test_unlocked_datesheet_allows_changes_and_drops_selections` |

## 4.5 Exam schedule management (full CRUD)

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| A-SL-1 | One or more slots per course, date + start time, optional end time | `scheduling/models.py` `ExamSlot`, `scheduling/admin_views.py`, `scheduling/slot_services.py`, `/admin/schedules` | Service, UI | `apps/scheduling/tests/test_slots.py::test_create_returns_local_date_day_and_times`<br>`apps/scheduling/tests/test_slots.py::test_end_time_is_optional` |
| A-SL-2 | Students choose from these slots (more than one gives real choice) | `scheduling/student_views.py` (`GET me/courses/`), `/student/dashboard` | Service, UI | `apps/scheduling/tests/test_datesheet.py::test_courses_lists_upcoming_slots_with_seats` |
| A-SL-3 | View, edit, delete slots | `scheduling/admin_views.py`, `/admin/schedules` | Service, UI | `apps/scheduling/tests/test_slots.py::test_free_slot_can_be_edited_and_deleted`<br>`apps/scheduling/tests/test_slots.py::test_list_filters_search_and_counts` |
| A-SL-4 | Chosen slots protected | `scheduling/slot_services.py`, README D2 | DB (`PROTECT` on `DatesheetSelection.slot`), Service (409 `IN_USE`), UI (lock badge) | `apps/scheduling/tests/test_slots.py::test_chosen_slot_cannot_be_edited_or_deleted` |
| A-SL-5 | Validation: not in past, no duplicate per course, end after start | `scheduling/admin_serializers.py`, `common/time.py` | DB (`unique_slot_per_course_start`, `slot_end_after_start`), Service (past check in Asia/Karachi), UI (past dates disabled) | `apps/scheduling/tests/test_datesheet.py::test_past_slot_rejected`<br>`apps/scheduling/tests/test_slots.py::test_duplicate_slot_is_409`<br>`apps/branches/tests/test_branches.py::test_validation_errors_are_422_with_field` |

## 4.6 Student requests

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| A-RQ-1 | List with student name, type, reason, date raised, status | `change_requests/admin_views.py`, `/admin/requests` | Service, UI | `apps/change_requests/tests/test_admin_requests.py::test_filters_and_search_return_filtered_counts`<br>`apps/change_requests/tests/test_admin_requests.py::test_retrieve_includes_current_datesheet` |
| A-RQ-2 | Approve or reject with optional remark | `change_requests/admin_services.py` (conditional update on `status='pending'`, sets unlock flag) | Service (409 if already reviewed), UI (review drawer, confirm) | `apps/change_requests/tests/test_admin_requests.py::test_approve_sets_unlock_flag_and_queues_email`<br>`apps/change_requests/tests/test_admin_requests.py::test_reject_changes_only_status_and_remark`<br>`apps/change_requests/tests/test_admin_requests.py::test_remark_is_limited_to_500_chars` |
| A-RQ-3 | Filter by status and type | `change_requests/admin_views.py` filters, `/admin/requests` tabs | Service, UI | `apps/change_requests/tests/test_admin_requests.py::test_filters_and_search_return_filtered_counts` |

## 4.7 Search and pagination

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| A-PG-1 | Branches list: search + pagination | `branches/views.py`, `common/pagination.py`, `components/data-table` | Service | `apps/students/tests/test_admin_students.py::test_list_is_paginated_with_filtered_count_and_annotations` |
| A-PG-2 | Courses list | `courses/views.py` | Service | `apps/branches/tests/test_branches.py::test_search_filter_and_filtered_count` |
| A-PG-3 | Students list | `students/views.py`, `students/filters.py` | Service | `apps/courses/tests/test_courses.py::test_list_search_filters_counts` |
| A-PG-4 | Assignments list | `students/views.py` (`/admin/assignments/`) | Service | `apps/students/tests/test_admin_assignments.py::test_assignment_list_search_filter_and_pagination` |
| A-PG-5 | Schedules list | `scheduling/admin_views.py` | Service | `apps/scheduling/tests/test_slots.py::test_list_filters_search_and_counts` |
| A-PG-6 | Requests list | `change_requests/admin_views.py` | Service | `apps/change_requests/tests/test_admin_requests.py::test_filters_and_search_return_filtered_counts` |
| A-PG-7 | Server-side: page and page size sent, only that page returned | `common/pagination.py` `StandardPagination`, `DataTable` (URL-synced `page`, `page_size`) | Service | `apps/students/tests/test_admin_students.py::test_list_is_paginated_with_filtered_count_and_annotations`<br>`apps/courses/tests/test_courses.py::test_list_has_no_n_plus_one` |
| A-PG-8 | Search results paginated; counter reflects filtered total | `StandardPagination` (`count` on the filtered queryset) | Service | `apps/change_requests/tests/test_admin_requests.py::test_filters_and_search_return_filtered_counts`<br>`apps/branches/tests/test_branches.py::test_search_filter_and_filtered_count` |
| A-PG-9 | No loading everything and slicing in the browser | `DataTable` fetches one page per request | UI | Code review: every admin page uses the shared `DataTable`, which sends `page`/`page_size`/`search` to the API; no list endpoint returns unpaginated data |

## 5.1 Login

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| S-LG-1 | Login with email and password | `accounts/views.py` (`login/`), `accounts/auth.py`, `/login` | Service (rate limited), UI | `apps/core/tests/test_foundation.py::test_login_sets_cookies_and_me_returns_flow`<br>`apps/accounts/tests/test_auth.py::test_login_failures_share_one_generic_message`<br>`apps/accounts/tests/test_auth.py::test_sixth_login_attempt_is_rate_limited` |
| S-LG-2 | No self-registration; accounts only from the admin | no signup endpoint or route | Service, UI | No sign-up route exists in `web/src/app` or the API (`apps/accounts/urls.py`); students are created only through `POST /admin/students/` |
| S-LG-3 | Forgot password via the same email mechanism | `accounts/views.py` (`forgot-password/`, `set-password/`), `/forgot-password`, `/set-password/[uid]/[token]` | Service (1 h token, same response for unknown email) | `apps/accounts/tests/test_auth.py::test_forgot_password_response_is_identical_for_unknown_email`<br>`apps/accounts/tests/test_auth.py::test_reset_link_older_than_one_hour_is_rejected` |

## 5.2 Branch selection (one time only)

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| S-BR-1 | After first login, branch selection page is shown | `students/state.py` (`home_route`), `accounts/views.py` login `redirect_to`, `/student/select-branch` | Service, UI | `apps/accounts/tests/test_auth.py::test_student_login_redirects_by_flow_state`<br>`apps/core/tests/test_foundation.py::test_flow_state_routes` |
| S-BR-2 | Only once; never shown again, goes straight to next page | `/student/select-branch` redirect on `needs_branch_selection = false`, `src/proxy.ts` | UI | `apps/students/tests/test_me_branch.py::test_select_branch_once`<br>`apps/accounts/tests/test_auth.py::test_student_login_redirects_by_flow_state` |
| S-BR-3 | Backend rejects a second call | `students/me_services.py` conditional `UPDATE ... WHERE branch IS NULL OR branch_unlocked` | Service (409 `LOCKED`) | `apps/students/tests/test_me_branch.py::test_select_branch_once`<br>`apps/students/tests/test_me_branch.py::test_concurrent_branch_selection_only_one_wins` |

## 5.3 Dashboard and date sheet design

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| S-DS-1 | Full read-only profile (personal, guardian, academic) + selected branch | `students/me_views.py` (`GET me/profile/`), `/student/dashboard` | Service (own data only), UI | `apps/students/tests/test_me_branch.py::test_profile_returns_own_data_only` |
| S-DS-2 | Assigned courses listed below | `scheduling/student_views.py` (`GET me/courses/`) | Service, UI | `apps/scheduling/tests/test_datesheet.py::test_courses_lists_upcoming_slots_with_seats`<br>`apps/scheduling/tests/test_datesheet.py::test_courses_query_count_is_constant` |
| S-DS-3 | One date and time per course from the admin's slots | `scheduling/datesheet_service.py` (slot must belong to course) | DB (FK, `one_slot_per_course`), Service (422), UI | `apps/scheduling/tests/test_datesheet.py::test_slot_from_another_course_rejected` |
| S-DS-4 | Slot for every assigned course before saving | `scheduling/datesheet_service.py` (selection set = assignment set) | Service (422), UI (save disabled) | `apps/scheduling/tests/test_datesheet.py::test_missing_course_rejected` |
| S-DS-5 | Conflict: same date and overlapping time blocked with a clear message | `scheduling/datesheet_service.py`, `common/time.py` `overlaps` | DB (`no_overlapping_exams` exclusion), Service (409 `SLOT_CONFLICT` naming courses), UI (live highlight) | `apps/scheduling/tests/test_datesheet.py::test_overlap_rejected_with_course_names`<br>`apps/scheduling/tests/test_datesheet.py::test_exclusion_constraint_is_final_guard`<br>`apps/core/tests/test_foundation.py::test_back_to_back_exams_allowed` |

## 5.4 Save, view and print

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| S-SV-1 | Date sheet shows name, reg no, program, branch | `scheduling/student_views.py` (`GET me/datesheet/`), `/student/datesheet` | UI | `apps/scheduling/tests/test_datesheet.py::test_datesheet_view_is_own_only` |
| S-SV-2 | Table: course code, title, date, day, time; sorted by date | same (`ordering = ["during"]`) | Service, UI | `apps/scheduling/tests/test_datesheet.py::test_datesheet_view_is_own_only` |
| S-SV-3 | Print Date Sheet button, clean printable page | `/student/datesheet` print stylesheet, PDF export | UI | `/student/datesheet` Print button (`window.print()`) with print styles; PDF download via `@react-pdf/renderer` |
| S-SV-4 | After save: date sheet and branch locked unless an admin approves | `scheduling/datesheet_service.py` (row lock, `datesheet_saved_at`), `students/me_services.py` | Service (409 `LOCKED`), UI | `apps/scheduling/tests/test_datesheet.py::test_save_success_locks`<br>`apps/students/tests/test_me_branch.py::test_select_branch_once` |

## 5.5 Need help: change requests

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| S-NH-1 | Two choices: change branch / change date sheet | `change_requests/student_views.py`, `/student/help` | Service, UI | `apps/change_requests/tests/test_student_requests.py::test_raise_and_list_own_requests` |
| S-NH-2 | Reason + submit; appears to admin as pending | `change_requests/student_services.py`, `/admin/requests` | Service, UI | `apps/change_requests/tests/test_student_requests.py::test_raise_and_list_own_requests`<br>`apps/change_requests/tests/test_student_requests.py::test_reason_length_validated`<br>`apps/change_requests/tests/test_student_requests.py::test_d8_needs_something_to_change` |
| S-NH-3 | Student sees status and admin remark | `GET me/requests/`, `/student/help` | Service, UI | `apps/change_requests/tests/test_student_requests.py::test_raise_and_list_own_requests`<br>`apps/change_requests/tests/test_admin_requests.py::test_reject_changes_only_status_and_remark` |
| S-NH-4 | Approved: next login reopens branch selection / date sheet page | `change_requests/admin_services.py` (sets `branch_unlocked` / `datesheet_unlocked`), `students/state.py` `home_route` | Service, UI | `apps/change_requests/tests/test_admin_requests.py::test_approve_sets_unlock_flag_and_queues_email`<br>`apps/accounts/tests/test_auth.py::test_student_login_redirects_by_flow_state` |
| S-NH-5 | Unlock is one time, locks again after use | `students/me_services.py`, `scheduling/datesheet_service.py` (flag cleared in the same transaction) | Service | `apps/scheduling/tests/test_datesheet.py::test_unlock_is_single_use_and_seats_move`<br>`apps/students/tests/test_me_branch.py::test_unlock_allows_one_change_and_moves_seats`<br>`apps/change_requests/tests/test_student_requests.py::test_active_unlock_blocks_new_request` |
| S-NH-6 | Rejected: nothing changes, remark shown | `change_requests/admin_services.py` reject | Service, UI | `apps/change_requests/tests/test_admin_requests.py::test_reject_changes_only_status_and_remark`<br>`apps/change_requests/tests/test_student_requests.py::test_new_request_allowed_after_rejection` |
| S-NH-7 | No two pending requests of the same type | `change_requests/models.py` `one_pending_request_per_type` | DB (partial unique index), Service (409), UI (option disabled) | `apps/change_requests/tests/test_student_requests.py::test_duplicate_pending_rejected`<br>`apps/core/tests/test_foundation.py::test_one_pending_request_per_type` |

## 7. Business rules (quick reference)

| ID | Rule (paper's "enforced where") | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| BR-1 | 4 to 6 courses per student (Backend and UI) | `students/services.py` | Service, UI | `apps/students/tests/test_admin_assignments.py::test_adding_seventh_course_is_422`<br>`apps/students/tests/test_admin_assignments.py::test_replace_outside_4_to_6_is_422` |
| BR-2 | Branch selected once; page does not reappear (Backend and UI) | `students/me_services.py`, `/student/select-branch` | Service, UI | `apps/students/tests/test_me_branch.py::test_select_branch_once`<br>`apps/students/tests/test_me_branch.py::test_concurrent_branch_selection_only_one_wins` |
| BR-3 | Date sheet saved once (Backend and UI) | `scheduling/datesheet_service.py` | Service, UI | `apps/scheduling/tests/test_datesheet.py::test_save_success_locks` |
| BR-4 | Only slots the admin created for that course (Backend) | `scheduling/datesheet_service.py` | DB (FK), Service | `apps/scheduling/tests/test_datesheet.py::test_slot_from_another_course_rejected` |
| BR-5 | No two courses at the same date and time (Backend and UI) | `scheduling/datesheet_service.py`, `scheduling/models.py` | DB (exclusion), Service, UI | `apps/scheduling/tests/test_datesheet.py::test_overlap_rejected_with_course_names`<br>`apps/core/tests/test_foundation.py::test_overlapping_exams_rejected_by_database` |
| BR-6 | Unlock after approval is single use (Backend) | `students/me_services.py`, `scheduling/datesheet_service.py` | Service | `apps/scheduling/tests/test_datesheet.py::test_unlock_is_single_use_and_seats_move` |
| BR-7 | Students see only own data; admin routes closed to students (Backend, role based) | `common/permissions.py` (`IsAdmin`, `IsStudent`), `/me/` endpoints use `request.user.student` | Service (403), UI (`src/proxy.ts`) | `apps/students/tests/test_admin_students.py::test_students_cannot_use_admin_endpoints`<br>`apps/students/tests/test_me_branch.py::test_admin_cannot_use_student_endpoints`<br>`apps/students/tests/test_me_branch.py::test_profile_returns_own_data_only`<br>`apps/scheduling/tests/test_datesheet.py::test_datesheet_view_is_own_only` |
| BR-8 | Unique email, reg no, branch code, course code (Database and validation) | `accounts/models.py`, `students/models.py`, `branches/models.py`, `courses/models.py`, serializers | DB, Service (409 with field errors) | `apps/students/tests/test_admin_students.py::test_duplicate_unique_fields_return_409_with_field_errors`<br>`apps/branches/tests/test_branches.py::test_duplicate_code_is_409_with_field_error`<br>`apps/courses/tests/test_courses.py::test_duplicate_course_code_is_409` |

## 8. Non-functional requirements

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| NF-1 | Responsive on phone, tablet, desktop; tables scroll or become cards; tested at 360 px | `components/data-table` (cards below `md`), `ResponsiveDialog`, shells with drawer | UI | TODO |
| NF-2 | Security: hashed passwords, token/session auth, role check on every route, input validation, SQLi and XSS protection | `config/settings.py` (Argon2), `accounts/auth.py` (JWT httpOnly cookies), `common/permissions.py`, serializers, ORM only, React escaping | Service, UI | `apps/core/tests/test_foundation.py::test_wrong_password_is_generic_401`<br>`apps/students/tests/test_admin_students.py::test_students_cannot_use_admin_endpoints`<br>`apps/accounts/tests/test_auth.py::test_sixth_login_attempt_is_rate_limited`<br>`apps/students/tests/test_admin_students.py::test_photo_upload_validates_type_and_size` |
| NF-3 | Usability: loading states, clear errors, delete confirmations, success feedback | `loading.tsx` skeletons, `ConfirmDialog`, sonner toasts, `common/exceptions.py` error format | UI, Service | TODO |
| NF-4 | Data integrity: relations and constraints (students, courses, branches, assignments, slots, selections, requests) | all `models.py`, README ERD and constraints table | DB | `apps/core/tests/test_foundation.py::test_overlapping_exams_rejected_by_database`<br>`apps/core/tests/test_foundation.py::test_seat_capacity_never_overbooks`<br>`apps/core/tests/test_foundation.py::test_one_pending_request_per_type` |
| NF-5 | Code quality: organised folders, meaningful names, env vars for secrets, no hard-coded credentials | repo layout, `backend/.env.example`, `django-environ` | Review | `ruff` and `eslint` clean; secrets only in `.env` (git-ignored), `.env.example` documents them |

## 10. Deliverables

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| DL-1 | Public/shared GitHub repo, regular commits from all members | Git history | Process | TODO |
| DL-2 | README: setup steps, env vars, ERD, assumptions | `README.md` | Docs | README: setup, env tables, Mermaid ERD, assumptions D1 onwards |
| DL-3 | Seed: at least 1 admin, 3 branches, 8 courses, 5 students, a few slots | `core/management/commands/seed.py` (1 admin, 4 branches, 10 courses, 5 students, ~25 slots) | Script | `apps/core/management/commands/seed.py`: 1 admin, 4 branches, 10 courses, 25 slots, 5 students |
| DL-4 | Admin and one student demo credential in README | `README.md` "Demo credentials" | Docs | README "Demo credentials" |
| DL-5 | Live link (if hosted) and a 5-minute demo | `README.md` links, `render.yaml`, `docs/DEMO.md` | Docs | TODO |

## Bonus

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| BN-1 | Seat capacity per slot per branch; slot disappears when full (3) | `scheduling/models.py` `SlotSeat`, `scheduling/seats.py`, `GET me/courses/` (full slots hidden), `/admin/schedules` capacity field | DB (`seat_booked_within_capacity`), Service (conditional `UPDATE`, 409 `SLOT_FULL`), UI | `apps/core/tests/test_foundation.py::test_seat_capacity_never_overbooks`<br>`apps/scheduling/tests/test_datesheet.py::test_full_slot_rejected`<br>`apps/scheduling/tests/test_datesheet.py::test_courses_lists_upcoming_slots_with_seats`<br>`apps/students/tests/test_me_branch.py::test_branch_change_blocked_when_new_branch_full` |
| BN-2 | Downloadable PDF date sheet (2) | `/student/datesheet` (`@react-pdf/renderer`, lazy loaded) | UI | `/student/datesheet` Download PDF (`@react-pdf/renderer`, loaded on click), file `datesheet-<regNo>.pdf` |
| BN-3 | Email to student on approve / reject (2) | `change_requests/admin_services.py`, `templates/emails/request_decision.*` | Service (outbox) | `apps/change_requests/tests/test_admin_requests.py::test_approve_sets_unlock_flag_and_queues_email`<br>`apps/change_requests/tests/test_admin_requests.py::test_reject_changes_only_status_and_remark` |
| BN-4 | Admin dashboard with counts and charts (2) | `dashboard/views.py`, `/admin` (Recharts) | Service, UI | `apps/dashboard/tests/test_dashboard.py::test_dashboard_numbers_match_data`<br>`apps/dashboard/tests/test_dashboard.py::test_dashboard_query_count_is_fixed` |
| BN-5 | Dark mode or audit log of admin actions (1) | `ThemeToggle` (next-themes); `core/models.py` `AuditLog`, `common/audit.py`, `/admin/audit-log` | UI, Service | `apps/core/tests/test_audit_log.py::test_list_is_newest_first_with_filters_and_search`<br>`apps/core/tests/test_audit_log.py::test_students_cannot_read_audit_log`<br>Both done: audit log page `/admin/audit-log` and light/dark theme toggle (`next-themes`) |
