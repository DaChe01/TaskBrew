# TheBrewingTerminal Task Manager

A full-stack task manager with authentication, priorities, due-date awareness and **priority-based email reminders**. Built with React, Express and PostgreSQL.

## Features

**Accounts**
- Register / log in with email and password (bcrypt, cost 12) and JWT sessions.
- Emails are trimmed and lower-cased; duplicate accounts are rejected by a database unique constraint (HTTP 409).
- Per-user opt-out for email reminders.

**Tasks**
- Create, edit, delete and complete tasks with title, description, priority (Low / Medium / High) and a due date.
- Server-side search, status and priority filters, sorting and pagination.
- "Clear completed" and live summary counts (total / active / done / overdue).

**Due-date awareness**
- Every task shows its status: overdue (red, with the number of days), due today, due tomorrow, due in N days.
- Completed tasks are never labelled overdue.
- Due dates are date-only values (`YYYY-MM-DD`) end to end, so they never shift by a day because of timezones.

**Email reminders (external notifications)**
Reminders are sent by email through any SMTP provider. The schedule depends on the task's priority:

| Priority | Reminder emails                                          |
| -------- | -------------------------------------------------------- |
| High     | 3 days before, 1 day before, on the due date, if overdue |
| Medium   | 1 day before, on the due date, if overdue                |
| Low      | on the due date only                                     |

- One digest email per user per run, most urgent task first.
- A reminder is never sent twice, completed tasks never trigger one, and overdue follow-ups stop after 7 days.
- A failed delivery is retried on the next run. Changing a task's due date starts a fresh reminder cycle.
- Reminders are optional. Without SMTP settings the feature is simply off.

**Quality**
- Automated tests for the API (real PostgreSQL) and the UI (React Testing Library).
- Loading, empty and error states, toast notifications, field-level validation, accessible labels, keyboard-friendly forms, responsive layout.

## Tech stack

| Layer    | Technology                                                                           |
| -------- | ------------------------------------------------------------------------------------ |
| Frontend | React 19, React Router, Axios, Vite, plain CSS                                       |
| Backend  | Node.js (ES modules), Express 5, express-validator, helmet, cors, express-rate-limit |
| Database | PostgreSQL, node-pg-migrate                                                          |
| Email    | nodemailer (SMTP), node-cron                                                         |
| Testing  | Vitest, Supertest, React Testing Library, jsdom                                      |
| Tooling  | ESLint, Prettier                                                                     |

The project does not use Tailwind or TypeScript.

## Project structure

```
.
├── backend/
│   ├── migrations/                 # node-pg-migrate files (never edit applied ones)
│   ├── src/
│   │   ├── app.js                  # builds the Express app (no port, no DB connection)
│   │   ├── server.js               # startup: config, DB check, scheduler, graceful shutdown
│   │   ├── config/                 # env.js (validated config), db.js (pool), pgTypes.js
│   │   ├── routes/                 # URL + middleware wiring
│   │   ├── validators/             # express-validator rules
│   │   ├── controllers/            # HTTP in / HTTP out
│   │   ├── services/               # business logic
│   │   ├── repositories/           # all SQL
│   │   ├── reminders/              # rules, email, job, scheduler
│   │   ├── middleware/             # auth, validation, error handling
│   │   ├── errors/AppError.js
│   │   └── utils/
│   ├── tests/                      # Vitest + Supertest
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── api/                    # Axios client + endpoint functions
    │   ├── context/                # AuthProvider, ToastProvider
    │   ├── hooks/                  # useAuth, useToast, useTasks, useDebouncedValue
    │   ├── components/             # ProtectedRoute, ReminderSettings, tasks/*
    │   ├── pages/                  # Home, Login, Register, Dashboard
    │   └── utils/                  # dates, errors, storage
    ├── tests/                      # Vitest + React Testing Library
    └── .env.example
```

Request flow: `route → validator → controller → service → repository → PostgreSQL`.

## Prerequisites

- Node.js 20 or newer
- PostgreSQL 14 or newer
- (Optional) SMTP credentials for email reminders, for example a Gmail app password, Brevo, or Mailtrap for testing

## Setup

### 1. Create the databases

```sql
CREATE DATABASE taskmanager_dev;
CREATE DATABASE taskmanager_test;   -- used only by the automated tests
```

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env        # then edit DATABASE_URL and JWT_SECRET
npm run migrate:up          # creates / upgrades the schema
npm run dev                 # http://localhost:5000  (or: npm start)
```

Generate a strong secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The server refuses to start if `DATABASE_URL` or `JWT_SECRET` is missing, if the secret is shorter than 32 characters, or if the database cannot be reached.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

During development Vite forwards `/api` to `http://localhost:5000`, so no API URL is needed. If the API is on another origin (for example in production), copy `.env.example` to `.env` and set `VITE_API_URL=https://your-api.example.com/api`.

## Environment variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | | PostgreSQL connection string |
| `JWT_SECRET` | yes | | At least 32 characters |
| `PORT` | no | `5000` | |
| `NODE_ENV` | no | `development` | |
| `FRONTEND_URL` | no | `http://localhost:5173` | Allowed CORS origin(s), comma separated |
| `JWT_EXPIRES_IN` | no | `7d` | |
| `DATABASE_SSL` | no | `true` in production | Use TLS for the database connection |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | no | `true` | Certificate verification stays on. Only set `false` if your provider's certificate cannot be verified |
| `TRUST_PROXY` | no | off | Number of reverse proxies in front of the API (use `1` on Render). Needed for correct rate limiting |
| `AUTH_RATE_LIMIT_MAX` | no | `20` | Login/register attempts per IP per 15 minutes |
| `APP_TIMEZONE` | no | `UTC` | IANA timezone that defines "today" for reminders and when the daily job runs |
| `REMINDER_CRON` | no | `0 9 * * *` | When the reminder job runs (in `APP_TIMEZONE`) |
| `SMTP_HOST`, `SMTP_FROM` | for reminders | | Both are needed to enable reminders |
| `SMTP_PORT` | no | `587` | Port 465 uses implicit TLS |
| `SMTP_USER`, `SMTP_PASS` | no | | SMTP login |
| `REMINDERS_ENABLED` | no | `true` | Set `false` to switch reminders off even when SMTP is configured |
| `REMINDER_TRIGGER_SECRET` | no | | Enables `POST /api/reminders/run` (see below) |
| `TEST_DATABASE_URL` | for tests | `postgresql://postgres:postgres@localhost:5432/taskmanager_test` | Must contain `test` in the database name |

### Frontend (`frontend/.env`)

| Variable | Description |
| --- | --- |
| `VITE_API_URL` | Optional. Base URL of the API including `/api`. Defaults to same-origin `/api` |

## Database

### Migrations

```bash
cd backend
npm run migrate:up              # apply all pending migrations
npm run migrate:down            # roll back the most recent migration
npm run migrate:down -- 2       # roll back the last two
```

| Migration | Purpose |
| --- | --- |
| `1792408845475_initial-schema` | Original `users` and `tasks` tables (left unchanged) |
| `1792600000000_data-integrity` | Cleans legacy data, adds constraints, `TIMESTAMPTZ`, indexes, `updated_at` trigger |
| `1792600000001_email-reminders` | `users.email_reminders` and the `task_reminders` log table |

**Upgrading an existing database.** `data-integrity` is written to keep existing data:
- Unknown or empty priorities become `Medium`; missing `completed` becomes `false`; blank titles become "Untitled task".
- Emails are lower-cased. If two accounts differ only by case, the migration stops with a clear message instead of merging them. Resolve those accounts, then re-run it.
- Legacy `TIMESTAMP` values are assumed to be UTC (the default on managed hosts). If your server used another session timezone, change the `AT TIME ZONE 'UTC'` clauses in the file before running it.
- Back up the database before upgrading production.

Both new migrations have `down` steps, so they can be reversed (rolling back keeps all rows).

### Schema overview

- **users**: `id`, `name`, `email` (unique, must be lower case), `password_hash`, `email_reminders` (default true), `created_at`.
- **tasks**: `id`, `user_id` → users (cascade delete), `title`, `description`, `priority` (`Low | Medium | High`, enforced by a CHECK), `due_date` (`DATE`), `completed`, `created_at`, `updated_at` (kept current by a trigger).
- **task_reminders**: one row per reminder sent, unique on `(task_id, kind, due_date)`, which is what makes reminders idempotent.
- Indexes: `(user_id, completed)`, `(user_id, created_at DESC)`, and a partial index on open tasks' `due_date` for the reminder job.

## Scripts

| | Backend (`cd backend`) | Frontend (`cd frontend`) |
| --- | --- | --- |
| Run | `npm run dev` / `npm start` | `npm run dev` |
| Test | `npm test` | `npm test` |
| Lint | `npm run lint` | `npm run lint` |
| Format | `npm run format` | `npm run format` |
| Build | n/a | `npm run build` (output in `dist/`), `npm run preview` |

**Backend tests need PostgreSQL.** They run against `TEST_DATABASE_URL`, apply the migrations automatically, and refuse to run if the database name does not contain "test", so your development data cannot be wiped.

## API reference

Base URL: `http://localhost:5000/api`. All bodies are JSON. Routes marked 🔒 need `Authorization: Bearer <token>`.

**Success:** `{ "success": true, "data": ... }` (lists also include `meta`).
**Error:** `{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [{ "field": "title", "message": "..." }] } }`

Common codes: `VALIDATION_ERROR` 400, `INVALID_JSON` 400, `AUTH_REQUIRED` / `INVALID_TOKEN` / `TOKEN_EXPIRED` 401, `INVALID_CREDENTIALS` 401, `TASK_NOT_FOUND` 404, `EMAIL_TAKEN` 409, `RATE_LIMITED` 429, `INTERNAL_ERROR` 500 (generic message; details are only logged server-side).

### Auth

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| POST | `/auth/register` | `name`, `email`, `password` (8 to 72 bytes) | 201 → `{ token, user }` |
| POST | `/auth/login` | `email`, `password` | 200 → `{ token, user }` |
| GET 🔒 | `/auth/me` | | `{ user }` |
| PATCH 🔒 | `/auth/me` | `email_reminders` (boolean) | Turn email reminders on or off |

```bash
curl -X POST localhost:5000/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"asha@example.com","password":"password123"}'
```

### Tasks 🔒

| Method | Path | Description |
| --- | --- | --- |
| GET | `/tasks` | List with filters (below) |
| GET | `/tasks/stats?today=YYYY-MM-DD` | `{ total, active, completed, overdue }` |
| POST | `/tasks` | Create. `title` required; `description`, `priority`, `due_date` optional |
| GET | `/tasks/:id` | One task |
| PUT | `/tasks/:id` | Full update. `title` required; omitted optional fields reset to defaults |
| PATCH | `/tasks/:id` | Partial update. At least one field. `due_date: null` clears the date |
| PATCH | `/tasks/:id/complete` | Toggle completed |
| DELETE | `/tasks/:id` | Delete one |
| DELETE | `/tasks/completed` | Delete all completed tasks → `{ deleted }` |

Task fields: `title` (1 to 255), `description` (up to 2000), `priority` (`Low | Medium | High`), `due_date` (`YYYY-MM-DD`), `completed` (boolean).

**List query parameters**

| Parameter | Values | Default |
| --- | --- | --- |
| `page` | integer ≥ 1 | `1` |
| `limit` | 1 to 50 | `10` |
| `status` | `all`, `active`, `completed` | `all` |
| `priority` | `Low`, `Medium`, `High` | any |
| `q` | text (max 100), matches title or description, case-insensitive | none |
| `sort` | `created_at`, `due_date`, `priority`, `title` | `created_at` |
| `order` | `asc`, `desc` | `desc` |

`priority` sorts High → Low with `desc`. Tasks without a due date come last when sorting by `due_date`. Any other value is rejected with 400; sort fields are chosen from a fixed allowlist and never inserted into SQL from user input.

```bash
curl 'localhost:5000/api/tasks?status=active&priority=High&sort=due_date&order=asc&page=1&limit=10' \
  -H "authorization: Bearer $TOKEN"
```

```json
{
  "success": true,
  "data": [{ "id": 7, "title": "Ship release", "description": "", "priority": "High",
             "due_date": "2026-11-02", "completed": false,
             "created_at": "2026-10-24T09:00:00.000Z", "updated_at": "2026-10-24T09:00:00.000Z" }],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

### Health and reminders

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Checks the API and database |
| POST | `/reminders/run` | Runs the reminder job now. Requires header `x-reminder-secret: <REMINDER_TRIGGER_SECRET>`. Returns 404 if no secret is configured |

## Email reminders in depth

1. Set `SMTP_HOST` and `SMTP_FROM` (plus `SMTP_USER` / `SMTP_PASS` / `SMTP_PORT` as your provider requires). The server logs "Email reminders scheduled" on startup.
2. Once a day (`REMINDER_CRON`, in `APP_TIMEZONE`) the job finds open tasks that have reached a reminder point for their priority and emails each user one digest.
3. Sent reminders are recorded in `task_reminders`, so restarts and repeat runs never send duplicates. If a task is created late (for example a High task due tomorrow), only the most urgent applicable reminder is sent, not the earlier ones.

**If your host puts the server to sleep** (for example free hosting tiers), the in-process schedule may not fire. Set `REMINDER_TRIGGER_SECRET` and have any free cron/uptime service call `POST /api/reminders/run` with the `x-reminder-secret` header once a day. This also wakes the server. Missed days are caught up automatically because the rules are based on the current date.

Quick local test with a throwaway SMTP inbox (for example Mailtrap): set the `SMTP_*` variables, create a High-priority task due today, then call the trigger endpoint:

```bash
curl -X POST localhost:5000/api/reminders/run -H 'x-reminder-secret: <your secret>'
```

## Security measures

- Passwords hashed with bcrypt (cost 12); never returned by the API or logged.
- JWT (HS256, algorithm pinned, 7-day expiry). Missing, malformed, tampered and expired tokens return distinct 401 codes. The user is re-checked in the database on every request, so deleted accounts lose access immediately.
- Every task query includes `user_id`, so users cannot read, change or delete each other's tasks (covered by tests).
- All input is validated before it reaches the database; SQL is fully parameterised; sort columns come from an allowlist; search wildcards are escaped.
- Unexpected errors return a generic 500. SQL errors, stack traces and database details are never sent to clients.
- Login does not reveal whether an email exists, and takes similar time either way. Registration does return "email already exists", a common usability trade-off.
- `helmet` security headers, strict CORS allowlist, 10 KB body limit, rate limiting on login and register.
- Configuration is validated at startup; secrets come only from environment variables. Database TLS certificate verification is on unless explicitly disabled.
- Reminder emails escape user-provided text. The manual trigger endpoint uses a constant-time secret comparison and is disabled by default.

## Known limitations

- **Session token storage:** the JWT is kept in `localStorage`, so it can be read by any script that runs on the page (for example through an XSS bug). HttpOnly cookies would avoid that but need CSRF protection; they are a possible future improvement. There is no refresh-token flow, so sessions end after 7 days.
- **Reminders** need working SMTP credentials and are sent as a daily digest, not at an exact time. The in-process scheduler stops when the server sleeps (see above).
- There is no password reset, email verification, or account deletion yet.
- The overdue count on the dashboard uses the browser's local date; reminders use `APP_TIMEZONE`. For users far from the server's timezone these can differ around midnight.
- The test suites cover the API (against a real database) and the UI (in jsdom with the API mocked). There are no browser end-to-end tests, and the visual layout (including the mobile layout) has not been checked in a real browser.
- A Vercel-hosted frontend needs a rewrite of all paths to `index.html` so refreshing `/tasks` works (React Router handles routing in the browser).
