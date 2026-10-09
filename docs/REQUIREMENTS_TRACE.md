# Requirements trace

Every requirement line of the Loopverse 3.0 question paper, where it is implemented and how it is enforced.
Paths are relative to the repo root (`backend/apps/...`, web routes under `web/src/app/...`).

**Evidence** is filled in by the integrator after merge: a test name (`apps/x/tests/test_y.py::test_z`), a screenshot in `docs/screenshots/`, or a manual check with date.

Legend for "Enforced by": **DB** = PostgreSQL constraint, **Service** = server-side service/serializer/permission, **UI** = frontend.

## 4.1 Branch management (full CRUD)

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| A-BR-1 | Create, view, update, delete branches | `branches/views.py` (`BranchViewSet`), `/admin/branches` | Service (`IsAdmin`), UI dialogs | TODO |
| A-BR-2 | Fields: name, code, city, address, contact number, status | `branches/models.py`, `branches/serializers.py` | DB (`unique_branch_code`), Service (validation), UI (form) | TODO |
| A-BR-3 | Student may sit exams in any **active** branch | `students/me_views.py` (`GET me/branches/`, `POST me/branch/`), `/student/select-branch` | Service (inactive → 422), UI (only active listed) | TODO |
| A-BR-4 | Branch chosen by students cannot be hard-deleted; choice explained in README | `branches/views.py` `destroy`, README D1 | DB (`PROTECT` on `Student.branch`, `DatesheetSelection.branch`), Service (409 `IN_USE`), UI ("Mark inactive") | TODO |

## 4.2 Course management (full CRUD)

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| A-CO-1 | Create, view, update, delete courses | `courses/views.py`, `/admin/courses` | Service, UI | TODO |
| A-CO-2 | Fields: code (unique), title, credit hours, department, status | `courses/models.py` (`Department` lookup), `courses/serializers.py` | DB (`unique_course_code`, `course_credit_hours_1_6`), Service, UI | TODO |

## 4.3 Student management (full CRUD)

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| A-ST-1 | Full CRUD on students | `students/views.py`, `students/services.py`, `/admin/students` | Service, UI | TODO |
| A-ST-2 | Personal: full name, email (unique), phone, CNIC/B-Form, DOB, gender, address, photo (optional) | `students/models.py`, `accounts/models.py` (email), `students/serializers.py` | DB (`User.email` unique, `unique_student_cnic`), Service (format, photo type/size) | TODO |
| A-ST-3 | Guardian: name, parent CNIC, occupation, contact, emergency contact | same | Service, UI (form group) | TODO |
| A-ST-4 | Academic: reg no (unique), program, semester, session, previous qualification, previous institute, marks/CGPA | same, `Program` lookup | DB (`unique_student_registration_no`, `student_semester_1_12`, `student_marks_non_negative`), Service | TODO |
| A-ST-5 | Email sent on create with secure set-password link | `students/services.py` → `accounts/services.py` `send_account_setup_email` → `common/emails.py` outbox, `templates/emails/account_setup.*` | Service (outbox row in the same transaction) | TODO |
| A-ST-6 | Link single-use and time-limited (24 h) | `accounts/tokens.py` (`setup_token_generator`, `token_nonce`), `accounts/services.py` | Service (signed token, nonce bump) | TODO |
| A-ST-7 | Passwords never stored or emailed in plain text | `config/settings.py` (`Argon2PasswordHasher`), email templates | Service | TODO |

## 4.4 Course assignment (full CRUD)

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| A-AS-1 | At least 4, at most 6 courses | `students/services.py` (row lock + count) | Service (422), UI (counter, disabled buttons) | TODO |
| A-AS-2 | Rule enforced on the server; fewer than 4 shows "assignment incomplete" and cannot proceed | `students/services.py`, `students/state.py` `flow_state`, date sheet endpoints, `/admin/students`, `/student/dashboard` | Service (403 `ASSIGNMENT_INCOMPLETE`), UI (badge, warning card) | TODO |
| A-AS-3 | Same course not assigned twice | `students/models.py` `unique_assignment`, `students/services.py` | DB, Service (409), UI | TODO |
| A-AS-4 | View, change, remove while 4 to 6 valid and no saved date sheet | `students/views.py` (assignments endpoints), `/admin/assignments`, `/admin/students/[id]` | Service, UI | TODO |
| A-AS-5 | Decide and document behaviour after save | `students/services.py` (409 `LOCKED` unless `datesheet_unlocked`), README D3 | Service, UI (disabled with reason) | TODO |

## 4.5 Exam schedule management (full CRUD)

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| A-SL-1 | One or more slots per course, date + start time, optional end time | `scheduling/models.py` `ExamSlot`, `scheduling/admin_views.py`, `scheduling/slot_services.py`, `/admin/schedules` | Service, UI | TODO |
| A-SL-2 | Students choose from these slots (more than one gives real choice) | `scheduling/student_views.py` (`GET me/courses/`), `/student/dashboard` | Service, UI | TODO |
| A-SL-3 | View, edit, delete slots | `scheduling/admin_views.py`, `/admin/schedules` | Service, UI | TODO |
| A-SL-4 | Chosen slots protected | `scheduling/slot_services.py`, README D2 | DB (`PROTECT` on `DatesheetSelection.slot`), Service (409 `IN_USE`), UI (lock badge) | TODO |
| A-SL-5 | Validation: not in past, no duplicate per course, end after start | `scheduling/admin_serializers.py`, `common/time.py` | DB (`unique_slot_per_course_start`, `slot_end_after_start`), Service (past check in Asia/Karachi), UI (past dates disabled) | TODO |

## 4.6 Student requests

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| A-RQ-1 | List with student name, type, reason, date raised, status | `change_requests/admin_views.py`, `/admin/requests` | Service, UI | TODO |
| A-RQ-2 | Approve or reject with optional remark | `change_requests/admin_services.py` (conditional update on `status='pending'`, sets unlock flag) | Service (409 if already reviewed), UI (review drawer, confirm) | TODO |
| A-RQ-3 | Filter by status and type | `change_requests/admin_views.py` filters, `/admin/requests` tabs | Service, UI | TODO |

## 4.7 Search and pagination

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| A-PG-1 | Branches list: search + pagination | `branches/views.py`, `common/pagination.py`, `components/data-table` | Service | TODO |
| A-PG-2 | Courses list | `courses/views.py` | Service | TODO |
| A-PG-3 | Students list | `students/views.py`, `students/filters.py` | Service | TODO |
| A-PG-4 | Assignments list | `students/views.py` (`/admin/assignments/`) | Service | TODO |
| A-PG-5 | Schedules list | `scheduling/admin_views.py` | Service | TODO |
| A-PG-6 | Requests list | `change_requests/admin_views.py` | Service | TODO |
| A-PG-7 | Server-side: page and page size sent, only that page returned | `common/pagination.py` `StandardPagination`, `DataTable` (URL-synced `page`, `page_size`) | Service | TODO |
| A-PG-8 | Search results paginated; counter reflects filtered total | `StandardPagination` (`count` on the filtered queryset) | Service | TODO |
| A-PG-9 | No loading everything and slicing in the browser | `DataTable` fetches one page per request | UI | TODO |

## 5.1 Login

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| S-LG-1 | Login with email and password | `accounts/views.py` (`login/`), `accounts/auth.py`, `/login` | Service (rate limited), UI | TODO |
| S-LG-2 | No self-registration; accounts only from the admin | no signup endpoint or route | Service, UI | TODO |
| S-LG-3 | Forgot password via the same email mechanism | `accounts/views.py` (`forgot-password/`, `set-password/`), `/forgot-password`, `/set-password/[uid]/[token]` | Service (1 h token, same response for unknown email) | TODO |

## 5.2 Branch selection (one time only)

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| S-BR-1 | After first login, branch selection page is shown | `students/state.py` (`home_route`), `accounts/views.py` login `redirect_to`, `/student/select-branch` | Service, UI | TODO |
| S-BR-2 | Only once; never shown again, goes straight to next page | `/student/select-branch` redirect on `needs_branch_selection = false`, `src/proxy.ts` | UI | TODO |
| S-BR-3 | Backend rejects a second call | `students/me_services.py` conditional `UPDATE ... WHERE branch IS NULL OR branch_unlocked` | Service (409 `LOCKED`) | TODO |

## 5.3 Dashboard and date sheet design

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| S-DS-1 | Full read-only profile (personal, guardian, academic) + selected branch | `students/me_views.py` (`GET me/profile/`), `/student/dashboard` | Service (own data only), UI | TODO |
| S-DS-2 | Assigned courses listed below | `scheduling/student_views.py` (`GET me/courses/`) | Service, UI | TODO |
| S-DS-3 | One date and time per course from the admin's slots | `scheduling/datesheet_service.py` (slot must belong to course) | DB (FK, `one_slot_per_course`), Service (422), UI | TODO |
| S-DS-4 | Slot for every assigned course before saving | `scheduling/datesheet_service.py` (selection set = assignment set) | Service (422), UI (save disabled) | TODO |
| S-DS-5 | Conflict: same date and overlapping time blocked with a clear message | `scheduling/datesheet_service.py`, `common/time.py` `overlaps` | DB (`no_overlapping_exams` exclusion), Service (409 `SLOT_CONFLICT` naming courses), UI (live highlight) | TODO |

## 5.4 Save, view and print

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| S-SV-1 | Date sheet shows name, reg no, program, branch | `scheduling/student_views.py` (`GET me/datesheet/`), `/student/datesheet` | UI | TODO |
| S-SV-2 | Table: course code, title, date, day, time; sorted by date | same (`ordering = ["during"]`) | Service, UI | TODO |
| S-SV-3 | Print Date Sheet button, clean printable page | `/student/datesheet` print stylesheet, PDF export | UI | TODO |
| S-SV-4 | After save: date sheet and branch locked unless an admin approves | `scheduling/datesheet_service.py` (row lock, `datesheet_saved_at`), `students/me_services.py` | Service (409 `LOCKED`), UI | TODO |

## 5.5 Need help: change requests

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| S-NH-1 | Two choices: change branch / change date sheet | `change_requests/student_views.py`, `/student/help` | Service, UI | TODO |
| S-NH-2 | Reason + submit; appears to admin as pending | `change_requests/student_services.py`, `/admin/requests` | Service, UI | TODO |
| S-NH-3 | Student sees status and admin remark | `GET me/requests/`, `/student/help` | Service, UI | TODO |
| S-NH-4 | Approved: next login reopens branch selection / date sheet page | `change_requests/admin_services.py` (sets `branch_unlocked` / `datesheet_unlocked`), `students/state.py` `home_route` | Service, UI | TODO |
| S-NH-5 | Unlock is one time, locks again after use | `students/me_services.py`, `scheduling/datesheet_service.py` (flag cleared in the same transaction) | Service | TODO |
| S-NH-6 | Rejected: nothing changes, remark shown | `change_requests/admin_services.py` reject | Service, UI | TODO |
| S-NH-7 | No two pending requests of the same type | `change_requests/models.py` `one_pending_request_per_type` | DB (partial unique index), Service (409), UI (option disabled) | TODO |

## 7. Business rules (quick reference)

| ID | Rule (paper's "enforced where") | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| BR-1 | 4 to 6 courses per student (Backend and UI) | `students/services.py` | Service, UI | TODO |
| BR-2 | Branch selected once; page does not reappear (Backend and UI) | `students/me_services.py`, `/student/select-branch` | Service, UI | TODO |
| BR-3 | Date sheet saved once (Backend and UI) | `scheduling/datesheet_service.py` | Service, UI | TODO |
| BR-4 | Only slots the admin created for that course (Backend) | `scheduling/datesheet_service.py` | DB (FK), Service | TODO |
| BR-5 | No two courses at the same date and time (Backend and UI) | `scheduling/datesheet_service.py`, `scheduling/models.py` | DB (exclusion), Service, UI | TODO |
| BR-6 | Unlock after approval is single use (Backend) | `students/me_services.py`, `scheduling/datesheet_service.py` | Service | TODO |
| BR-7 | Students see only own data; admin routes closed to students (Backend, role based) | `common/permissions.py` (`IsAdmin`, `IsStudent`), `/me/` endpoints use `request.user.student` | Service (403), UI (`src/proxy.ts`) | TODO |
| BR-8 | Unique email, reg no, branch code, course code (Database and validation) | `accounts/models.py`, `students/models.py`, `branches/models.py`, `courses/models.py`, serializers | DB, Service (409 with field errors) | TODO |

## 8. Non-functional requirements

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| NF-1 | Responsive on phone, tablet, desktop; tables scroll or become cards; tested at 360 px | `components/data-table` (cards below `md`), `ResponsiveDialog`, shells with drawer | UI | TODO |
| NF-2 | Security: hashed passwords, token/session auth, role check on every route, input validation, SQLi and XSS protection | `config/settings.py` (Argon2), `accounts/auth.py` (JWT httpOnly cookies), `common/permissions.py`, serializers, ORM only, React escaping | Service, UI | TODO |
| NF-3 | Usability: loading states, clear errors, delete confirmations, success feedback | `loading.tsx` skeletons, `ConfirmDialog`, sonner toasts, `common/exceptions.py` error format | UI, Service | TODO |
| NF-4 | Data integrity: relations and constraints (students, courses, branches, assignments, slots, selections, requests) | all `models.py`, README ERD and constraints table | DB | TODO |
| NF-5 | Code quality: organised folders, meaningful names, env vars for secrets, no hard-coded credentials | repo layout, `backend/.env.example`, `django-environ` | Review | TODO |

## 10. Deliverables

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| DL-1 | Public/shared GitHub repo, regular commits from all members | Git history | Process | TODO |
| DL-2 | README: setup steps, env vars, ERD, assumptions | `README.md` | Docs | TODO |
| DL-3 | Seed: at least 1 admin, 3 branches, 8 courses, 5 students, a few slots | `core/management/commands/seed.py` (1 admin, 4 branches, 10 courses, 5 students, ~25 slots) | Script | TODO |
| DL-4 | Admin and one student demo credential in README | `README.md` "Demo credentials" | Docs | TODO |
| DL-5 | Live link (if hosted) and a 5-minute demo | `README.md` links, `render.yaml`, `docs/DEMO.md` | Docs | TODO |

## Bonus

| ID | Requirement | Implemented in | Enforced by | Evidence |
|---|---|---|---|---|
| BN-1 | Seat capacity per slot per branch; slot disappears when full (3) | `scheduling/models.py` `SlotSeat`, `scheduling/seats.py`, `GET me/courses/` (full slots hidden), `/admin/schedules` capacity field | DB (`seat_booked_within_capacity`), Service (conditional `UPDATE`, 409 `SLOT_FULL`), UI | TODO |
| BN-2 | Downloadable PDF date sheet (2) | `/student/datesheet` (`@react-pdf/renderer`, lazy loaded) | UI | TODO |
| BN-3 | Email to student on approve / reject (2) | `change_requests/admin_services.py`, `templates/emails/request_decision.*` | Service (outbox) | TODO |
| BN-4 | Admin dashboard with counts and charts (2) | `dashboard/views.py`, `/admin` (Recharts) | Service, UI | TODO |
| BN-5 | Dark mode or audit log of admin actions (1) | `ThemeToggle` (next-themes); `core/models.py` `AuditLog`, `common/audit.py`, `/admin/audit-log` | UI, Service | TODO |
