# hackathonLoopLab

## ExamSlot: a self-service exam date sheet system

ExamSlot is a full-stack, responsive web app for a multi-branch virtual university. Admins manage branches, courses, students, course assignments and exam slots. Each student picks an exam branch once, chooses one slot for every assigned course, saves and prints the date sheet, and can ask for a one-time change through **Need Help**.

Built for **Loopverse 3.0** (Web Dev, onsite).

| | Link |
|---|---|
| Live web app | `TODO(integrator): https://<project>.vercel.app` |
| API (Swagger UI) | `TODO(integrator): https://<service>.onrender.com/api/v1/docs/` |
| OpenAPI schema | `TODO(integrator): https://<service>.onrender.com/api/v1/schema/` |
| Demo script | [docs/DEMO.md](docs/DEMO.md) |
| Requirement trace | [docs/REQUIREMENTS_TRACE.md](docs/REQUIREMENTS_TRACE.md) |

### Screenshots

> `TODO(integrator):` add screenshots to `docs/screenshots/` and uncomment.

<!--
| Desktop | Mobile (360 px) |
|---|---|
| ![Admin dashboard](docs/screenshots/admin-dashboard.png) | ![Admin students as cards](docs/screenshots/admin-students-mobile.png) |
| ![Date sheet designer](docs/screenshots/student-designer.png) | ![Date sheet](docs/screenshots/student-datesheet-mobile.png) |
| ![Requests review](docs/screenshots/admin-requests.png) | ![Dark mode](docs/screenshots/dark-mode-mobile.png) |
-->

---

## Contents

1. [Demo credentials](#demo-credentials)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Tech stack](#tech-stack)
5. [Getting started (Windows)](#getting-started-windows)
6. [Environment variables](#environment-variables)
7. [Database design (ERD)](#database-design-erd)
8. [Business rules and where they are enforced](#business-rules-and-where-they-are-enforced)
9. [Assumptions and decisions](#assumptions-and-decisions)
10. [Security](#security)
11. [API overview](#api-overview)
12. [Project structure](#project-structure)
13. [Testing](#testing)
14. [Deploy](#deploy)
15. [Team](#team)

---

## Demo credentials

Created by `uv run python manage.py seed` (see `backend/apps/core/management/commands/seed.py`).

| Role | Email | Password | State after a fresh seed |
|---|---|---|---|
| Admin | `admin@examslot.app` | `Admin@123` | Full admin panel |
| Student | `ali@student.examslot.app` | `Student@123` | 5 courses assigned, **no branch yet**: lands on branch selection |
| Student | `sara@student.examslot.app` | `Student@123` | Branch Lahore, 4 courses, **ready to design** the date sheet |
| Student | `usman@student.examslot.app` | `Student@123` | Branch Islamabad, 6 courses, **date sheet saved** (locked, printable) |
| Student | `ayesha@student.examslot.app` | `Student@123` | Only 3 courses: **assignment incomplete**, cannot design |
| Student | `bilal@student.examslot.app` | `Student@123` | Branch Karachi, date sheet saved, **pending date sheet change request** |

Seed contents: 1 admin, 4 branches (Peshawar is inactive), 4 departments, 3 programs, 10 courses, 2 to 3 future slots per course starting 14 days ahead. Odd-numbered courses get an extra slot that overlaps the previous course, so the conflict check can be shown. The first CS101 slot has a capacity of 2 seats per branch; the first ENG101 and PHY101 slots have 30.

---

## Features

### Admin panel (`/admin`)
- **Dashboard**: totals, saved vs not saved date sheets, incomplete assignments, pending requests, students per branch, requests by status (charts).
- **Branches**: full CRUD, activate/deactivate, safe delete (blocked when in use, with a "Mark inactive" option).
- **Courses** and **departments**: full CRUD; course code unique; delete blocked when the course has assignments or slots.
- **Students** and **programs**: full CRUD with three form groups (personal, guardian, academic), optional photo, account setup email on create, resend invite.
- **Course assignments**: 4 to 6 courses per student, enforced on the server; "assignment incomplete" badge.
- **Exam schedule**: slots per course with date, start time, optional end time and optional seat capacity per branch; validation; chosen slots are locked.
- **Student requests**: filter by status and type, approve or reject with a remark; approval grants a one-time unlock and emails the student.
- **Audit log** of admin actions.
- Every list has **server-side search and pagination** (page, page size, search and filters are sent to the API; the count is the filtered total).

### Student panel (`/student`)
- Login with email and password; no self-registration; forgot password by email.
- One-time **branch selection**; the page never comes back unless an admin approves a branch change.
- **Dashboard** with the full read-only profile and selected branch, then the **date sheet designer**: one slot per assigned course, live conflict check, save is blocked until every course has a slot and nothing overlaps.
- **Date sheet** view sorted by date with **Print** (print stylesheet) and **Download PDF**.
- **Need Help**: request a branch change or a date sheet change, see status and the admin's remark.

### Bonus
| Bonus | Status |
|---|---|
| Seat capacity per slot per branch; full slots disappear | Built (`SlotSeat` counter + DB check constraint) |
| Downloadable PDF date sheet | Built (`@react-pdf/renderer`, loaded on click) |
| Email on request approve / reject | Built (`request_decision` template via outbox) |
| Admin dashboard with counts and charts | Built (Recharts) |
| Dark mode **and** audit log | Built (both) |

`TODO(integrator):` confirm each row after merge and remove anything that did not land.

---

## Architecture

```
 Browser (phone / desktop)
        │  https
        ▼
 Next.js on Vercel (App Router, React Server Components)
        │  /api/* is rewritten to Django (same origin, so auth cookies just work)
        ▼
 Django 5 + DRF on Render (Gunicorn + Uvicorn workers, ASGI)
   JWT cookie auth → DRF permissions (IsAdmin / IsStudent) → serializer validation
   → service layer → transaction.atomic()
        │                         │                          │
        ▼                         ▼                          ▼
 PostgreSQL (Neon)          Redis (optional)           Email outbox → Resend
 source of truth:           cache, rate limits,        rows written in the same
 FKs, unique, check,        Celery broker              transaction, sent after commit
 exclusion and partial                                 (Celery if Redis, else inline)
 unique constraints
```

| Piece | Status |
|---|---|
| Next.js frontend, Django REST API, PostgreSQL constraints, save transaction with row lock | Built |
| Transactional email outbox (sent right after commit; Celery worker when `CELERY_BROKER_URL` is set) | Built |
| Redis cache and rate limiting (falls back to in-memory when `REDIS_URL` is empty) | Built |
| Seat counters with conditional `UPDATE ... WHERE booked < capacity` | Built |
| Cloudflare CDN/WAF, virtual waiting room for the "everyone at 9:00" spike | Documented only |
| PgBouncer + read replica for admin lists | Documented only |
| One row per seat with `SELECT ... FOR UPDATE SKIP LOCKED` for very large slots | Documented only (scaling path) |

The full reasoning (research on enrollment crashes, Shopify and Ticketmaster patterns, why the database stays the source of truth) is in the design notes the team used while building.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query, react-hook-form + zod, Recharts, `@react-pdf/renderer` |
| API | Django 5.2 + Django REST Framework, drf-spectacular (OpenAPI + Swagger UI), django-filter |
| Auth | simplejwt tokens in httpOnly cookies, Argon2 password hashing, Django signed password-reset tokens |
| Database | PostgreSQL 16 (Neon) with `btree_gist` and `pg_trgm` |
| Jobs / cache | Celery + Redis (optional), django-redis |
| Email | django-anymail with Resend (SMTP or console as fallbacks) |
| Serving | Gunicorn + Uvicorn workers, WhiteNoise for static files |
| Tooling | uv (Python), npm (Node), ruff, pytest-django, ESLint |

**Why Django:** its built-ins cover a large part of the marks directly: signed single-use password links, auth, server-side pagination, search and filters, migrations, and Postgres-specific constraints (`ExclusionConstraint`, partial `UniqueConstraint`) declared on the model. FastAPI would mean hand-building all of that; Next.js route handlers cannot run background workers and struggle with database connection spikes. The trade-off (two languages) is softened by generating TypeScript types from the OpenAPI schema (`npm run gen:api`).

---

## Getting started (Windows)

### Prerequisites
- **Python 3.13** and **[uv](https://docs.astral.sh/uv/)** (`powershell -c "irm https://astral.sh/uv/install.ps1 | iex"`)
- **Node.js 20+** and npm
- **PostgreSQL 16**: a free [Neon](https://neon.tech) database, or a local Postgres
- Optional: **Docker Desktop** for Redis and Mailpit (`docker compose up -d`)

### 1. Backend (PowerShell)
```powershell
cd backend
uv sync
Copy-Item .env.example .env        # then edit DATABASE_URL, SECRET_KEY, JWT_SECRET
uv run python manage.py migrate    # creates tables, constraints and the btree_gist / pg_trgm extensions
uv run python manage.py seed       # demo data (use --reset to rebuild it)
uv run python manage.py seed_mock  # optional: 20 more students in mixed states + requests
uv run waitress-serve --listen=127.0.0.1:8000 --threads=8 --channel-timeout=120 config.wsgi:application
```
(`runserver` also works for calling the API directly, but it closes connections after each response, which the frontend proxy reuses; waitress, like gunicorn in production, keeps them alive.)
API docs: http://localhost:8000/api/v1/docs/

### 2. Frontend (second terminal)
```powershell
cd web
npm install
$env:BACKEND_URL="http://localhost:8000"   # optional, this is the default
npm run dev
```
App: http://localhost:3000

### 3. Optional: Redis, Mailpit and a Celery worker
```powershell
docker compose up -d                       # redis on 6379, mailpit on 1025 (inbox at http://localhost:8025)
```
In `backend/.env` set `REDIS_URL=redis://localhost:6379/0` (cache) and optionally `CELERY_BROKER_URL=redis://localhost:6379/1` (background email worker), and for Mailpit `EMAIL_HOST=localhost`, `EMAIL_PORT=1025`, `EMAIL_USE_TLS=False`. Then run a worker (Celery needs the solo pool on Windows):
```powershell
cd backend
uv run celery -A config worker --pool=solo -l info
```
Without Redis everything still works: emails are sent right after the database commit, and the cache and rate limits use local memory. Without any email settings, emails are printed to the backend console (copy the set-password link from there).

---

## Environment variables

### Backend (`backend/.env`, template in `backend/.env.example`)

| Variable | Required | Example / default | Purpose |
|---|---|---|---|
| `SECRET_KEY` | yes | long random string | Django signing key (also signs password links) |
| `DEBUG` | yes | `True` locally, `False` in production | Debug mode; also turns on secure cookies and HSTS when `False` |
| `ALLOWED_HOSTS` | yes | `localhost,127.0.0.1` | Hosts Django will serve |
| `FRONTEND_URL` | yes | `http://localhost:3000` | Base URL used in emailed set-password links |
| `CSRF_TRUSTED_ORIGINS` | yes | `http://localhost:3000` | Origins allowed to send unsafe requests |
| `CORS_ALLOWED_ORIGINS` | yes | `http://localhost:3000` | Origins allowed by CORS (credentials on) |
| `JWT_SECRET` | yes | long random string | Signs access/refresh tokens (defaults to `SECRET_KEY`) |
| `AUTH_COOKIE_SECURE` | no | defaults to `not DEBUG` | `Secure` flag on auth cookies |
| `DATABASE_URL` | yes | `postgresql://user:pass@host/db?sslmode=require` | PostgreSQL connection |
| `DB_CONN_MAX_AGE` | no | `60` | Persistent DB connection lifetime (seconds) |
| `TEST_DB_NAME` | tests | `test_examslot` | Name of the pytest database |
| `REDIS_URL` | no | empty, or `rediss://default:<token>@<host>.upstash.io:6379` | Shared Redis cache and rate limits |
| `CELERY_BROKER_URL` | no | empty, or `redis://localhost:6379/1` | Background email worker (needs `celery -A config worker`); empty = send right after commit |
| `MAIL_FROM` | no | `ExamSlot <no-reply@examslot.app>` | Sender address |
| `RESEND_API_KEY` | no | `re_...` | Send email through Resend (takes priority) |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS` | no | Gmail / Mailpit settings | SMTP fallback; if neither Resend nor SMTP is set, emails go to the console |
| `SETUP_TOKEN_TIMEOUT_SECONDS` | no | `86400` (24 h) | Account setup link lifetime |
| `RESET_TOKEN_TIMEOUT_SECONDS` | no | `3600` (1 h) | Forgot-password link lifetime |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_STUDENT_PASSWORD` | no | `admin@examslot.app`, `Admin@123`, `Student@123` | Seed credentials |

### Web (`web/`, set in the shell or in Vercel)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `BACKEND_URL` | yes in production | `http://127.0.0.1:8000` | Django base URL; `next.config.ts` rewrites `/api/*` to it so the browser only talks to one origin |

No secrets are hard-coded; `.env` files are git-ignored.

---

## Database design (ERD)

Also available as a standalone page: [docs/ERD.md](docs/ERD.md).

Generated from the actual Django models in `backend/apps/*/models.py`. `docs/erd.png` (`TODO(integrator):` export this diagram, e.g. with mermaid.live) is a static copy.

```mermaid
erDiagram
    USER ||--o| STUDENT : "has profile (CASCADE)"
    PROGRAM ||--o{ STUDENT : "enrols (PROTECT)"
    BRANCH |o--o{ STUDENT : "chosen by (PROTECT, nullable)"
    DEPARTMENT ||--o{ COURSE : "owns (PROTECT)"
    STUDENT ||--o{ COURSE_ASSIGNMENT : "has 4 to 6 (CASCADE)"
    COURSE ||--o{ COURSE_ASSIGNMENT : "assigned in (PROTECT)"
    COURSE ||--o{ EXAM_SLOT : "offered in (PROTECT)"
    EXAM_SLOT ||--o{ SLOT_SEAT : "seat counter (CASCADE)"
    BRANCH ||--o{ SLOT_SEAT : "seat counter (CASCADE)"
    STUDENT ||--o{ DATESHEET_SELECTION : "picks (CASCADE)"
    COURSE ||--o{ DATESHEET_SELECTION : "for (PROTECT)"
    EXAM_SLOT ||--o{ DATESHEET_SELECTION : "chosen in (PROTECT)"
    BRANCH ||--o{ DATESHEET_SELECTION : "sat at (PROTECT)"
    STUDENT ||--o{ CHANGE_REQUEST : "raises (CASCADE)"
    USER |o--o{ CHANGE_REQUEST : "reviews (SET NULL)"
    USER |o--o{ AUDIT_LOG : "acts (SET NULL)"

    USER {
        uuid id PK
        varchar email UK "lower-case, login"
        varchar password "Argon2 hash, unusable until set"
        varchar role "admin or student"
        bool is_active
        bool is_staff
        bool is_superuser
        int token_nonce "bumped on every link issued or used"
        timestamptz last_login
        timestamptz date_joined
    }
    PROGRAM {
        uuid id PK
        varchar name
        varchar code UK
        smallint duration_semesters
        timestamptz created_at
        timestamptz updated_at
    }
    STUDENT {
        uuid id PK
        uuid user_id FK, UK "1 to 1 with USER"
        varchar full_name
        varchar phone
        varchar cnic UK "CNIC or B-Form"
        date date_of_birth
        varchar gender "male, female, other"
        varchar address
        varchar photo "optional image path"
        varchar guardian_name
        varchar guardian_cnic
        varchar guardian_occupation
        varchar guardian_contact
        varchar emergency_contact
        varchar registration_no UK
        uuid program_id FK
        smallint semester "CHECK 1 to 12"
        varchar session "e.g. 2024-2028"
        varchar previous_qualification
        varchar previous_institute
        decimal marks_or_cgpa "CHECK >= 0"
        uuid branch_id FK "nullable until chosen"
        timestamptz branch_selected_at
        timestamptz datesheet_saved_at "null = not saved"
        bool branch_unlocked "one-time unlock"
        bool datesheet_unlocked "one-time unlock"
        int version "optimistic locking"
        timestamptz created_at
        timestamptz updated_at
    }
    BRANCH {
        uuid id PK
        varchar name
        varchar code UK
        varchar city
        varchar address
        varchar contact_number
        varchar status "active or inactive"
        timestamptz created_at
        timestamptz updated_at
    }
    DEPARTMENT {
        uuid id PK
        varchar name
        varchar code UK
        timestamptz created_at
        timestamptz updated_at
    }
    COURSE {
        uuid id PK
        varchar code UK
        varchar title
        smallint credit_hours "CHECK 1 to 6"
        uuid department_id FK
        varchar status "active or inactive"
        timestamptz created_at
        timestamptz updated_at
    }
    COURSE_ASSIGNMENT {
        bigint id PK
        uuid student_id FK "UK with course_id"
        uuid course_id FK "UK with student_id"
        timestamptz created_at
    }
    EXAM_SLOT {
        uuid id PK
        uuid course_id FK "UK with start_at"
        timestamptz start_at "UK with course_id"
        timestamptz end_at "nullable, CHECK > start_at"
        int capacity_per_branch "nullable = unlimited, CHECK > 0"
        timestamptz created_at
        timestamptz updated_at
    }
    SLOT_SEAT {
        bigint id PK
        uuid slot_id FK "UK with branch_id"
        uuid branch_id FK "UK with slot_id"
        int capacity "copied from slot, nullable"
        int booked "CHECK booked <= capacity"
    }
    DATESHEET_SELECTION {
        bigint id PK
        uuid student_id FK "UK with course_id"
        uuid course_id FK "UK with student_id"
        uuid slot_id FK
        uuid branch_id FK "branch at booking time"
        tstzrange during "copy of slot time, EXCLUDE overlap per student"
        timestamptz created_at
    }
    CHANGE_REQUEST {
        uuid id PK
        uuid student_id FK
        varchar type "change_branch or change_datesheet"
        text reason
        varchar status "pending, approved, rejected"
        text admin_remark
        uuid reviewed_by_id FK "nullable"
        timestamptz reviewed_at
        timestamptz created_at
        timestamptz updated_at
    }
    AUDIT_LOG {
        bigint id PK
        uuid actor_id FK "nullable"
        varchar action "CREATE UPDATE DELETE APPROVE REJECT"
        varchar entity
        varchar entity_id
        varchar label
        jsonb details
        timestamptz created_at
    }
    EMAIL_OUTBOX {
        uuid id PK
        varchar to
        varchar template
        jsonb context
        varchar status "pending, sent, failed"
        smallint attempts
        text last_error
        timestamptz created_at
        timestamptz sent_at
    }
```

`USER` also has Django's standard `groups` / `user_permissions` many-to-many tables (from `PermissionsMixin`), omitted for clarity.

### Constraints enforced by PostgreSQL

| Table | Constraint | Type | What it guarantees |
|---|---|---|---|
| `USER` | `email` unique | Unique | One account per email |
| `STUDENT` | `unique_student_registration_no`, `unique_student_cnic`, `user_id` unique | Unique | Unique registration number, CNIC, one profile per login |
| `BRANCH` | `unique_branch_code` | Unique | Unique branch code |
| `COURSE` | `unique_course_code` | Unique | Unique course code |
| `DEPARTMENT`, `PROGRAM` | `unique_department_code`, `unique_program_code` | Unique | Unique lookup codes |
| `COURSE_ASSIGNMENT` | `unique_assignment (student, course)` | Unique | Same course never assigned twice to a student |
| `EXAM_SLOT` | `unique_slot_per_course_start (course, start_at)` | Unique | No duplicate slot for a course |
| `EXAM_SLOT` | `slot_end_after_start`: `end_at IS NULL OR end_at > start_at` | Check | End time after start time |
| `EXAM_SLOT` | `slot_capacity_positive`: `capacity_per_branch IS NULL OR > 0` | Check | Valid capacity |
| `SLOT_SEAT` | `unique_seat_slot_branch (slot, branch)` | Unique | One counter per slot per branch |
| `SLOT_SEAT` | `seat_booked_within_capacity`: `capacity IS NULL OR booked <= capacity` | Check | **Overbooking is impossible**, even under races |
| `DATESHEET_SELECTION` | `one_slot_per_course (student, course)` | Unique | One slot per course per student |
| `DATESHEET_SELECTION` | `no_overlapping_exams`: `EXCLUDE USING gist (student_id WITH =, during WITH &&)` | **Exclusion** (needs `btree_gist`) | A student can never hold two overlapping exams, whatever the code does |
| `CHANGE_REQUEST` | `one_pending_request_per_type (student, type) WHERE status = 'pending'` | **Partial unique index** | At most one pending request of each type per student |
| `COURSE` | `course_credit_hours_1_6` | Check | Credit hours 1 to 6 |
| `STUDENT` | `student_semester_1_12`, `student_marks_non_negative` | Check | Valid semester and marks |

### Delete rules (foreign keys)

| Foreign key | On delete | Why |
|---|---|---|
| `STUDENT.user` | CASCADE | Deleting a login removes its profile |
| `STUDENT.branch`, `DATESHEET_SELECTION.branch` | **PROTECT** | A branch chosen by students cannot be hard-deleted (D1) |
| `STUDENT.program`, `COURSE.department` | PROTECT | Lookups in use cannot disappear |
| `COURSE_ASSIGNMENT.course`, `EXAM_SLOT.course`, `DATESHEET_SELECTION.course` | PROTECT | A course with assignments, slots or selections cannot be deleted (D10) |
| `DATESHEET_SELECTION.slot` | **PROTECT** | A slot chosen by a student cannot be deleted (D2) |
| `COURSE_ASSIGNMENT.student`, `DATESHEET_SELECTION.student`, `CHANGE_REQUEST.student` | CASCADE | Deleting a student removes their assignments, selections and requests (D10) |
| `SLOT_SEAT.slot`, `SLOT_SEAT.branch` | CASCADE | Counters are derived data; they go with their slot/branch (which are themselves protected while chosen) |
| `CHANGE_REQUEST.reviewed_by`, `AUDIT_LOG.actor` | SET NULL | History survives if an admin account is removed |

### Indexes
Every FK is indexed. Composite indexes match the list queries: `(status, name)` on branches, `(status, code)` on courses, `(course, start_at)` on slots, `(status, type, -created_at)` and `(student, -created_at)` on requests, `(program, semester)` and `(branch, datesheet_saved_at)` on students, `(slot, branch)` on selections, `(entity, -created_at)` on the audit log. `pg_trgm` GIN indexes on searched text (user email, branch name and city, course code and title, student name and registration number) keep `icontains` search fast. Partial indexes cover hot filters: students `WHERE datesheet_saved_at IS NULL`, outbox `WHERE status = 'pending'`.

### Normalisation
The schema is in **third normal form**:
- **Lookup tables instead of repeated text**: `Department` (referenced by `Course`) and `Program` (referenced by `Student`), so a department or program name is stored once and renamed in one place.
- **Login separate from profile**: `User` holds only credentials and role; `Student` holds the profile. Admins have a `User` and no `Student`.
- Guardian and academic fields stay on `Student` because they are strictly one-to-one with the student and always read together; splitting them would add joins without removing any redundancy or transitive dependency.
- Assignments, selections and requests are their own tables with foreign keys, never comma-separated lists.

### Three deliberate denormalisations
1. **`DatesheetSelection.during`** copies the slot's time range (with a missing end time filled in as start + 3 h). Postgres exclusion constraints cannot look across a join, so the copy is what lets the database itself reject overlapping exams.
2. **`DatesheetSelection.branch`** records the branch at booking time. Seat accounting and history stay correct even when the student later changes branch.
3. **`SlotSeat.booked`** is a counter instead of `COUNT(*)` over selections. "Is it full?" becomes one conditional `UPDATE ... SET booked = booked + 1 WHERE booked < capacity`, and the `CHECK (booked <= capacity)` makes overbooking impossible under concurrent saves.

---

## Business rules and where they are enforced

| # | Rule | Database | Server (service layer) | UI |
|---|---|---|---|---|
| R1 | 4 to 6 courses per student | | Student row locked, count checked, 422 outside 4 to 6 | Counter "4 / 6", add/remove disabled at the limits |
| R2 | Fewer than 4 courses: cannot design | | 403 `ASSIGNMENT_INCOMPLETE` on date sheet endpoints | Warning card instead of the designer |
| R3 | Course not assigned twice | `unique_assignment` | Pre-check, 409 | Assigned courses removed from the picker |
| R4 | No assignment changes after save (unless unlocked) | | 409 `LOCKED` | Edit actions disabled with a reason |
| R5 | Branch chosen once | | Single conditional `UPDATE ... WHERE branch IS NULL OR branch_unlocked`; 0 rows → 409 `LOCKED` | Select-branch page redirects away once chosen |
| R6 | Only active branches | | 422 for inactive branch | Only active branches listed |
| R7 | Date sheet saved once | | Row lock + `datesheet_saved_at` check in the save transaction, 409 `LOCKED` | Designer replaced by the read-only date sheet |
| R8 | Slot must belong to that course | FK | Each slot checked against the assigned course | Only that course's slots shown |
| R9 | Every assigned course needs a slot | `one_slot_per_course` | Selection set must equal the assignment set, 422 | Save disabled until complete |
| R10 | No overlapping exams | `no_overlapping_exams` exclusion constraint | Pairwise check with clear course names, 409 `SLOT_CONFLICT` | Live red highlight and message, save disabled |
| R11 | Unlock is single use | | Flag cleared in the same transaction that uses it | Banner explains it works once |
| R12 | One pending request per type | `one_pending_request_per_type` partial unique index | Pre-check, 409 | Option disabled while pending |
| R13 | Students see only their own data | | Student endpoints use `request.user.student`, never an id from the URL | |
| R14 | Admin routes closed to students | | `IsAdmin` on every admin view, 403 | Proxy routes by role cookie |
| R15 | Unique email, reg no, branch code, course code | Unique constraints | Serializer validation, 409 `CONFLICT` with field errors | Inline field error |
| R16 | Branch in use cannot be hard-deleted | `PROTECT` FKs | 409 `IN_USE` with "Mark inactive" | Dialog with "Mark inactive" |
| R17 | Chosen slots protected | `PROTECT` FK | Edit and delete blocked, 409 `IN_USE` with count | Lock badge "Chosen by N" |
| R18 | Slot validation | `slot_end_after_start`, `unique_slot_per_course_start` | Not in the past (Asia/Karachi), end after start, no duplicate | Past dates disabled, inline errors |
| R19 | Password link single-use and time-limited | | Signed token includes `token_nonce`; nonce bumped when a link is issued or used | "Link expired or already used" page |
| R20 | Passwords never stored or emailed in plain text | | Argon2 hashing; emails contain only a link | |
| R21 | No self-registration | | No signup endpoint | No signup link |
| R22 | Seat capacity per branch | `seat_booked_within_capacity` | Conditional `UPDATE ... WHERE booked < capacity`, 409 `SLOT_FULL` | Full slots hidden |

Full trace from every line of the question paper: [docs/REQUIREMENTS_TRACE.md](docs/REQUIREMENTS_TRACE.md).

---

## Assumptions and decisions

Where the question paper is silent, we chose the following:

| ID | Decision |
|---|---|
| D1 | **Branch safe-delete: block, then offer "Mark inactive".** If any student has chosen the branch (or a saved selection references it), delete returns 409 and the admin can deactivate it instead. Inactive branches are hidden from new selections, but students who already chose them keep them. Reason: printed date sheets and history stay valid; nothing changes silently for a student. The database enforces it too (`PROTECT` foreign keys). |
| D2 | **Slot protection: block.** A slot chosen by at least one student cannot be edited or deleted; the admin sees "Chosen by N". Reason: a student's locked date sheet must never change behind their back. To retire such a slot, the student first gets a date sheet change approved. |
| D3 | **Assignments after a saved date sheet: blocked** (the recommended rule). The admin can change them only while the student has an approved, unused date sheet change (unlock active). Selections for removed courses are deleted in the same transaction and their seats released. While a student has fewer than 4 courses, add and remove are allowed (they stay "assignment incomplete"). |
| D4 | **Slots are per course, not per branch.** A slot is valid at every branch; the student's branch is where they sit it. Seat capacity (bonus) is counted per slot per branch. |
| D5 | **Missing end time = 3 hours.** A slot without an end time is treated as start + 3 h for conflict checks and on the date sheet. |
| D6 | **Overlap definition:** two exams conflict when `startA < endB` and `startB < endA` (half-open ranges `[start, end)`). **Back-to-back is allowed**: an exam ending at 12:00 and one starting at 12:00 do not conflict. |
| D7 | **Branch change after a saved date sheet** keeps the chosen slots (slots are branch-independent) and moves the seats to the new branch. If a seat is full there, the student is told to also request a date sheet change. |
| D8 | **Requests need something to change:** a branch change request only after a branch is chosen; a date sheet change only after a date sheet is saved. |
| D9 | **Unlock is single use:** approval sets `branch_unlocked` or `datesheet_unlocked`. The flag is cleared in the same database transaction that saves the new branch or date sheet, so parallel requests cannot use it twice. After use, the page locks again. |
| D10 | **Deleting a student** cascades their assignments, selections and requests (with a warning in the UI). Deleting a course with assignments or slots, or a department/program in use, is blocked. |
| D11 | **Token lifetimes:** the account setup link is valid for **24 hours**, the forgot-password link for **1 hour**. Both are single use. Issuing a new link invalidates older unused links (the token includes a per-user nonce). |
| D12 | **Forgot password** always shows the same message, so it does not reveal which emails have accounts. |
| D13 | **Session:** JWT in httpOnly cookies: 15-minute access token, refreshed automatically with a rotating 7-day refresh token. `TODO(integrator):` confirm final values (the plan said 8 h). |
| D14 | **Time zone:** all dates and times are **Asia/Karachi (PKT)**; "in the past" is checked against the current PKT time. Stored as UTC (`USE_TZ = True`). |
| D15 | **Inactive courses** cannot be newly assigned or get new slots. Existing assignments are kept. |
| D16 | **Redis is optional in development.** Without `REDIS_URL`, cache and rate limits use local memory; with it (Upstash), they are shared across server instances. Emails are sent right after commit unless `CELERY_BROKER_URL` is set, in which case a Celery worker sends them. |
| D17 | **Emails go through a transactional outbox:** the email row is written in the same transaction as the change (student created, request decided), so an email is never sent for a change that rolled back, and never lost for one that committed. |
| D18 | **Student photos** are stored on the server's local media folder. On free hosting this disk is temporary, so photos are a local-only feature unless S3-compatible storage is configured. `TODO(integrator):` keep or change. |
| D19 | **Email is the login and is stored lower-case**; CNIC is also unique per student. |
| D20 | **Approving a request when the student already has an active unlock** simply keeps it unlocked; two admins approving the same request at once is safe (conditional update on `status = 'pending'`, the second gets 409). |

`TODO(integrator):` append any further decisions reported by the feature sessions (see `docs/REQUESTS_FOR_INTEGRATOR.md`).

---

## Security

- **Passwords**: Argon2 hashing; Django password validators (length, common, numeric, similarity). Students are created with an unusable password and set it only through the emailed link. Passwords are never emailed or logged.
- **Password links**: HMAC-signed Django tokens (24 h setup, 1 h reset) that die after use or when a newer link is issued.
- **Authentication**: JWT access and refresh tokens in **httpOnly**, `SameSite=Lax`, `Secure` (production) cookies, so JavaScript cannot read them. A separate non-httpOnly `role` cookie is used only for frontend routing; the backend is the real guard.
- **Authorization**: `IsAdmin` / `IsStudent` permission classes on every view. Student endpoints always use the logged-in student, never an id from the request.
- **Validation**: DRF serializers on every input, plus database constraints as the last line of defence.
- **SQL injection**: only the Django ORM (parameterised queries); no raw SQL strings.
- **XSS**: React escapes output; no `dangerouslySetInnerHTML` or `mark_safe` on user data; Django templates auto-escape emails.
- **CSRF / CORS**: `SameSite` cookies, `CSRF_TRUSTED_ORIGINS`, CORS allowlist; the frontend calls the API through a same-origin rewrite.
- **Rate limiting**: login and forgot-password are rate limited per IP and per email (429 `RATE_LIMITED`).
- **Headers**: HSTS, `nosniff`, `X-Frame-Options: DENY`, strict referrer policy in production.
- **Secrets**: all from environment variables; no credentials in the code.

---

## API overview

Interactive docs: **`/api/v1/docs/`** (Swagger UI). Schema: `/api/v1/schema/`.

| Prefix | Who | Examples |
|---|---|---|
| `/api/v1/auth/` | public / any | `login/`, `logout/`, `refresh/`, `me/`, `forgot-password/`, `validate-token/`, `set-password/` |
| `/api/v1/admin/` | admin only | `branches/`, `courses/`, `departments/`, `students/`, `programs/`, `assignments/`, `slots/`, `requests/{id}/approve/`, `requests/{id}/reject/`, `audit-log/`, `dashboard/` |
| `/api/v1/me/` | student only (own data) | `profile/`, `branches/`, `branch/`, `courses/`, `datesheet/`, `requests/` |
| `/api/v1/health/` | public | health check |

**Lists**: `?page=2&page_size=10&search=ali&ordering=-created_at&status=active` returns `{"results", "count", "page", "page_size", "total_pages"}`, where `count` is the filtered total. Page sizes: 5, 10, 20, 50.

**Errors**: `{"error": {"code", "message", "field_errors"}}`. Codes: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION` (422), `CONFLICT` (409), `IN_USE` (409), `LOCKED` (409), `ASSIGNMENT_INCOMPLETE` (403), `SLOT_CONFLICT` (409), `SLOT_FULL` (409), `RATE_LIMITED` (429), `LINK_INVALID` (400).

---

## Project structure

```
backend/                     Django 5 + DRF (uv, Python 3.13)
  config/                    settings, urls, wsgi, celery
  common/                    pagination, permissions, exceptions, audit, time, emails, rate limits, base viewset
  apps/
    accounts/                custom User, JWT cookie auth, password setup/reset tokens and endpoints
    branches/                branch CRUD + safe delete
    courses/                 courses + departments
    students/                students, programs, course assignments (4 to 6), flow state, student profile API
    scheduling/              exam slots, seat counters, date sheet save transaction
    change_requests/         Need Help requests, approve/reject, one-time unlock
    notifications/           email outbox + Celery tasks
    dashboard/               admin stats
    core/                    audit log, seed command
  templates/emails/          HTML + text email templates
web/                         Next.js (App Router, TypeScript, Tailwind, shadcn/ui)
  src/app/(auth)/            login, forgot-password, set-password
  src/app/admin/             dashboard, branches, courses, students, assignments, schedules, requests, audit-log
  src/app/student/           select-branch, dashboard (designer), datesheet, help
  src/components/            ui, data-table (table on desktop, cards on mobile), shared, layout
  src/features/<area>/       feature components and hooks
  src/lib/api.ts             fetch wrapper with refresh-and-retry
  src/api/schema.d.ts        generated API types
docs/                        demo script, requirement trace, screenshots, ERD image
docker-compose.yml           optional Redis + Mailpit
render.yaml                  Render blueprint for the backend
```

---

## Testing

```powershell
cd backend
uv run ruff check .
uv run pytest                    # all apps; set TEST_DB_NAME in .env
uv run pytest apps/scheduling    # one app

cd ..\web
npm run lint
npx tsc --noEmit
```

The tests prove backend enforcement of every rule (4 to 6 courses, once-only branch and date sheet, forged slot ids, overlaps, single-use unlock, one pending request per type, link reuse and expiry, slot validation, protected deletes, filtered pagination counts, role checks). `TODO(integrator):` add the test count and the concurrency / k6 results from `docs/QA_REPORT.md`.

---

## Deploy

| Part | Service | Notes |
|---|---|---|
| Database | **Neon** (production branch) | `btree_gist` and `pg_trgm` are created by the first migration |
| Backend | **Render** web service from `backend/` ([render.yaml](render.yaml)) | Build: `uv sync --frozen && uv run python manage.py collectstatic --noinput && uv run python manage.py migrate`. Start: `uv run gunicorn config.wsgi:application --workers 2 --threads 4 --bind 0.0.0.0:$PORT --keep-alive 75 --timeout 60` (threaded WSGI workers serve requests in parallel; keep-alive longer than the frontend proxy's idle timeout avoids reset connections) |
| Frontend | **Vercel**, root directory `web/` | Set `BACKEND_URL=https://<service>.onrender.com`. The `/api/*` rewrite keeps auth cookies on the Vercel origin |
| Email | **Resend** | Set `RESEND_API_KEY` and a `MAIL_FROM` on a verified domain (or Gmail SMTP via `EMAIL_HOST*`) |
| Redis | **Upstash** | Set `REDIS_URL` (`rediss://...`) for the shared cache and rate limits |

Backend production variables (on Render):
- `DEBUG=False`, `SECRET_KEY`, `JWT_SECRET` (random), `DATABASE_URL` (Neon, `sslmode=require`)
- `ALLOWED_HOSTS=<service>.onrender.com`
- `FRONTEND_URL=https://<project>.vercel.app` (used in emailed links)
- `CSRF_TRUSTED_ORIGINS=https://<project>.vercel.app,https://<service>.onrender.com`
- `CORS_ALLOWED_ORIGINS=https://<project>.vercel.app`
- `AUTH_COOKIE_SECURE=True`
- `RESEND_API_KEY`, `MAIL_FROM`, optional `REDIS_URL`

Steps:
1. Create the Neon database and copy its connection string.
2. On Render: **New > Blueprint**, pick this repo; fill the `sync: false` variables. First deploy runs the migrations.
3. Seed once from the Render shell: `uv run python manage.py seed && uv run python manage.py seed_mock`.
4. On Vercel: import the repo, root directory `web`, set `BACKEND_URL`, deploy.
5. Put the Vercel URL into `FRONTEND_URL`, `CSRF_TRUSTED_ORIGINS` and `CORS_ALLOWED_ORIGINS` on Render and redeploy.
6. Smoke test: admin login, create a student with a real inbox, open the email, set a password, complete the student journey.

---

## Team

`TODO(team):` fill in names and who built what.

| Member | GitHub | Built |
|---|---|---|
| `TODO` | `TODO` | Foundation: models, constraints, auth, outbox, seed, design system, deploy |
| `TODO` | `TODO` | Authentication and email flows |
| `TODO` | `TODO` | Branches, courses, admin dashboard |
| `TODO` | `TODO` | Students and course assignments |
| `TODO` | `TODO` | Exam slots, request review, audit log |
| `TODO` | `TODO` | Student panel: branch, designer, date sheet, print/PDF, Need Help |
| `TODO` | `TODO` | QA, security review, documentation |
