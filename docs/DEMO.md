# ExamSlot: 5-minute demo kit

## Before the demo (10 minutes ahead)

1. **Reset the demo data** (wipes all ExamSlot data and users, then reseeds; slot dates are relative to today, so they are always in the future):
   ```powershell
   cd backend
   uv run python manage.py seed --reset
   ```
   On Render: open the service **Shell** and run the same command.
2. Open these tabs:
   - Tab A (normal window): live app `TODO(integrator): https://<project>.vercel.app/login`, logged in as **admin** `admin@examslot.app` / `Admin@123`.
   - Tab B (private window): the same URL, logged out (for students).
   - Tab C: the inbox you will use for the new student (a real address you can open on the projector), or Mailpit `http://localhost:8025` for a local run.
   - Tab D: the README on GitHub, scrolled to the ERD.
3. In Tab A, open DevTools > Network and filter by `Fetch/XHR` (used once to prove server-side pagination).
4. Pick a password for the reset flow that is **not** `Student@123`, for example `Exam!Slot2026` (Django rejects passwords too similar to the email, and `Student@123` is).

**Backup plan:** if the network or hosting fails, run locally (README "Getting started") with the console email backend, and keep a screen recording of the full script (`docs/demo.mp4`, `TODO(team):` record it) ready to play.

## Seeded users

| User | Password | Use it to show |
|---|---|---|
| `admin@examslot.app` | `Admin@123` | All admin screens |
| `ali@student.examslot.app` | `Student@123` | First login: one-time branch selection |
| `sara@student.examslot.app` | `Student@123` | Date sheet designer, conflict message, save, print, PDF |
| `usman@student.examslot.app` | `Student@123` | Already saved and locked date sheet |
| `ayesha@student.examslot.app` | `Student@123` | Only 3 courses: "assignment incomplete" |
| `bilal@student.examslot.app` | `Student@123` | Pending date sheet change request: approve and one-time unlock |

## Script

| Time | Who | Exact steps | Say |
|---|---|---|---|
| 0:00 to 0:30 | Admin (Tab A) | Show `/admin` dashboard: stat cards and charts. | "ExamSlot lets each student design their own date sheet, exactly once. Django + DRF API, Next.js frontend, PostgreSQL enforcing the rules." |
| 0:30 to 1:30 | Admin | **Students > Add student**: fill the three groups (Personal, Guardian, Academic) with the Tab C email. Save, toast shows the email was queued. Switch to Tab C: the "account created" email with a set-password button. Back in Tab A: **Branches**, type `lah` in search, change page size; in Network, point at `?page=1&page_size=10&search=lah` and the filtered `count`. Try **Delete** on Lahore Campus: blocked, "Mark inactive" offered. | "Pagination and search run on the server; the count is the filtered total. A branch students chose can't be hard-deleted, only deactivated." |
| 1:30 to 2:00 | Admin | **Assignments** for the new student: add 3 courses, show "assignment incomplete"; try a 7th on a student with 6 (`usman`): error "at most 6". **Schedules > Add slot**: pick a past date, show the error; show a slot with "Chosen by N" and its disabled delete. | "4 to 6 is enforced on the server; chosen slots are locked so no saved date sheet changes silently." |
| 2:00 to 3:15 | Student (Tab B) | Tab C: click the link, set password `Exam!Slot2026`, log in: lands on **branch selection** (one time; confirm dialog). Then log out and log in as **`sara`** (branch already chosen): dashboard shows the read-only profile and the designer. Pick **CS101** first slot (09:00, day 14) and **MTH101** slot on the same day at 09:00: red conflict message, Save disabled. Change MTH101 to another slot, pick ENG101 and PHY101, **Save** (confirm). Date sheet view sorted by date: **Print** (print preview) and **Download PDF**. | "The overlap check runs live in the UI, again in the service, and finally as a Postgres exclusion constraint, so two exams can never overlap even if someone bypasses the UI." |
| 3:15 to 4:15 | Admin + `bilal` | Tab A: **Requests**, filter Pending: Bilal's "change date sheet" request. Review, remark "Approved, pick a new CS301 slot", **Approve**. (Bilal's address is not a real inbox: show the decision email in the backend console, or the new `EmailOutbox` row in Django admin.) Tab B: log in as **`bilal`**: the designer is unlocked with an info banner. Change one slot, Save: locked again. Open **Need Help**: request shows Approved with the remark. Try raising two date sheet requests: the second is blocked. | "Approval grants a one-time unlock; it's cleared in the same transaction as the save, so it can't be used twice." |
| 4:15 to 4:45 | Either | DevTools device toolbar at **360 px**: admin students list turns into cards, sidebar becomes a drawer, dialogs become bottom sheets. Toggle **dark mode**. Show the **Audit log**. | "Every page works at 360 px; tables collapse to cards." |
| 4:45 to 5:00 | README (Tab D) | Scroll: ERD, constraints table, assumptions D1 to D20, security summary. | "Every assumption where the paper was silent is written down here." |

Extra if asked: log in as `ayesha` (only 3 courses) to show "assignment incomplete" blocking the designer; log in as `usman` to show a locked, saved date sheet; call `POST /api/v1/me/branch/` twice from Swagger to show the 409.

## Explain the code (one paragraph per area)

**Data model and constraints** (`backend/apps/*/models.py`). Thirteen tables in 3NF: `Department` and `Program` are lookups, `User` (login) is separate from `Student` (profile). Postgres enforces the important rules itself: unique codes and emails, `CHECK` constraints (credit hours, semester, end after start, `booked <= capacity`), an **exclusion constraint** `EXCLUDE USING gist (student WITH =, during WITH &&)` so a student can never hold two overlapping exams, and a **partial unique index** allowing only one pending request per type. `PROTECT` foreign keys stop deleting branches, courses and slots that are in use. `DatesheetSelection.during`, `.branch` and `SlotSeat.booked` are deliberate copies that make those constraints and the seat check possible.

**Authentication and emails** (`apps/accounts`, `common/emails.py`, `apps/notifications`). Login returns JWTs in httpOnly cookies (JavaScript can't read them). Students are created with an unusable password; the setup email carries a Django signed token (24 h; reset links 1 h) that includes a per-user `token_nonce`, so a link stops working once used or once a newer link is issued. Emails are written to an `EmailOutbox` table inside the same transaction as the change and sent after commit, by Celery when Redis is configured, otherwise inline.

**Admin CRUD, search and pagination** (`common/views.py`, `common/pagination.py`, `apps/branches`, `apps/courses`, `apps/students`). Every admin list is a DRF viewset with `IsAdmin`, `SearchFilter`, `django-filter` and our `StandardPagination`, which counts the filtered queryset so the page counter matches the search. On the frontend the shared `DataTable` keeps `page`, `page_size`, `search` and filters in the URL, debounces search, and shows cards below 768 px. Admin writes are recorded in the audit log.

**Course assignments** (`apps/students/services.py`). Inside `transaction.atomic()` the student row is locked with `select_for_update()`, the current count is checked (4 to 6), duplicates are rejected (also by a unique constraint), and changes are blocked with 409 `LOCKED` after a date sheet is saved unless an approved unlock is active.

**Exam slots** (`apps/scheduling/slot_services.py`). Dates and times are combined in Asia/Karachi; the serializer rejects past slots, end before start and duplicates (also unique in the DB). A slot with selections can't be edited or deleted (409 plus `PROTECT`). Optional capacity creates per-branch `SlotSeat` counters.

**Branch selection and the save transaction** (`apps/students/me_services.py`, `apps/scheduling/datesheet_service.py`). Branch selection is one conditional `UPDATE ... WHERE branch IS NULL OR branch_unlocked`; if it touches 0 rows the API returns 409, so even two tabs can't select twice. Saving a date sheet locks the student row, checks the assignment count, the saved/unlocked flags, that the chosen courses equal the assigned ones and that each slot belongs to its course, reserves seats with `UPDATE ... SET booked = booked + 1 WHERE booked < capacity`, inserts the selections (the exclusion constraint is the final overlap guard), sets `datesheet_saved_at` and clears the unlock flag, all in one transaction.

**Requests and one-time unlock** (`apps/change_requests`). A student raises a request with a reason; the partial unique index allows one pending request per type. The admin approves or rejects with a conditional update on `status = 'pending'` (two admins can't both decide it); approval sets `branch_unlocked` or `datesheet_unlocked` and queues the decision email in the same transaction. `students/state.py` turns these flags into the student's `home_route`, so the next login opens the right page.

**Frontend** (`web/`). Next.js App Router with Server Components by default; `/api/*` is rewritten to Django so cookies are same-origin. `src/lib/api.ts` wraps fetch, refreshes the token once on 401 and maps API errors to form fields. `src/proxy.ts` routes by role; the backend is the real guard. TanStack Query handles caching and invalidation; shadcn/ui components, a soft blue palette, dark mode, print styles and a lazily loaded PDF renderer for the date sheet.
