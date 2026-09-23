# Lead Tracker

A small full-stack app for creating, listing, searching and updating the status of sales leads.

| Part       | Stack                                            | Folder    |
| ---------- | ------------------------------------------------ | --------- |
| Frontend   | React + TypeScript (Vite)                        | `client/` |
| Backend    | Node.js + TypeScript + Express 5                 | `server/` |
| Database   | PostgreSQL via `pg` (parameterized SQL, no ORM)  |           |
| Tests      | Vitest + Supertest                               |           |

> Status: initial scaffolding. The lead features are not implemented yet.

## Prerequisites

- Node.js 22.12+ or 24+
- A running PostgreSQL server (local or hosted)

## Getting started

### 1. Backend

```bash
cd server
npm install
cp .env.example .env   # then edit DATABASE_URL (and CORS_ORIGIN if needed)
npm run db:schema      # create the leads table (safe to re-run)
npm run dev            # http://localhost:3000
```

Check it's running: <http://localhost:3000/api/health> should return `{"status":"ok"}`.

The server connects to PostgreSQL on startup and exits with an error if `DATABASE_URL`
is missing or the database is unreachable.

### 2. Frontend

```bash
cd client
npm install
npm run dev            # http://localhost:5173
```

The frontend calls the API at `http://localhost:3000` by default. To use a different URL,
copy `client/.env.example` to `client/.env.local` and set `VITE_API_URL`.

## Backend scripts (`server/`)

| Script               | What it does                                    |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Start the API with auto-reload (tsx watch)      |
| `npm run build`      | Compile TypeScript to `dist/`                   |
| `npm start`          | Run the compiled server (`dist/index.js`)       |
| `npm run typecheck`  | Type-check all TypeScript without emitting      |
| `npm test`           | Run the test suite once                         |
| `npm run test:watch` | Run tests in watch mode                         |
| `npm run db:schema`  | Apply `db/schema.sql` to `DATABASE_URL`         |

## API

| Method  | Path                      | Body                       | Success                    |
| ------- | ------------------------- | -------------------------- | -------------------------- |
| `GET`   | `/api/health`             |                            | `200 {"status":"ok"}`      |
| `GET`   | `/api/leads?search=term`  |                            | `200` leads, newest first  |
| `POST`  | `/api/leads`              | `{ name, email, phone }`   | `201` created lead         |
| `PATCH` | `/api/leads/:id`          | `{ status }`               | `200` updated lead         |

`search` is optional and matches name, email or phone (case-insensitive). New leads start
with status `new`; valid statuses are `new`, `contacted`, `qualified`, `converted`, `lost`.

A lead looks like:

```json
{
  "id": 1,
  "name": "Asha Rao",
  "email": "asha@example.com",
  "phone": "+91 98765 43210",
  "status": "new",
  "createdAt": "2026-09-23T10:15:00.000Z"
}
```

Errors return `{ "error": "message" }`, plus a `details` object with per-field messages on
validation errors: `400` invalid input, `404` lead not found, `409` email already exists.

## Database

The schema lives in [`server/db/schema.sql`](server/db/schema.sql): a single `leads` table with
an identity primary key, non-blank `name`/`email`/`phone`, a `status` limited by a CHECK
constraint (default `new`), a `created_at` timestamp, and a case-insensitive unique index on
email. Apply it with `npm run db:schema`, or paste it into the Supabase SQL Editor.

## Tests

Both apps use [Vitest](https://vitest.dev). Run each suite from its folder:

```bash
cd server && npm test
cd client && npm test
```

### Backend (`server/`)

| File                               | Covers                                                        | Needs a database |
| ---------------------------------- | ------------------------------------------------------------- | ---------------- |
| `tests/app.test.ts`                | Health check, JSON 404, malformed JSON                        | no               |
| `tests/leads.routes.test.ts`       | Endpoint status codes and error mapping (repository mocked)   | no               |
| `tests/leads.validation.test.ts`   | Email, phone, id and search validation rules                  | no               |
| `tests/leads.repository.test.ts`   | The real SQL: create, duplicates, search, ordering, updates   | yes              |

The repository tests run only when `TEST_DATABASE_URL` is set, and are skipped otherwise.
They create a temporary schema, apply `db/schema.sql` to it and drop it afterwards, so
`TEST_DATABASE_URL` can safely be the same database as `DATABASE_URL`. Tests never use
`DATABASE_URL` itself.

### Frontend (`client/`)

React Testing Library in a jsdom environment. The API module and toasts are mocked, so no
server is needed.

| File                                   | Covers                                                           |
| -------------------------------------- | ---------------------------------------------------------------- |
| `src/api.test.ts`                      | Request URLs, methods, JSON bodies and error handling            |
| `src/components/LeadForm.test.tsx`     | Create flow, per-field server errors, duplicate email, toasts    |
| `src/components/LeadTable.test.tsx`    | Rows and links, status changes, disabled select while saving     |
| `src/App.test.tsx`                     | Loading, debounced search, empty/error states, status updates    |

## Environment variables (`server/.env`)

| Variable            | Required | Default                 | Description                                  |
| ------------------- | -------- | ----------------------- | -------------------------------------------- |
| `DATABASE_URL`      | yes      |                         | PostgreSQL connection string                 |
| `PORT`              | no       | `3000`                  | Port the API listens on                      |
| `CORS_ORIGIN`       | no       | `http://localhost:5173` | Comma-separated list of allowed origins      |
| `TEST_DATABASE_URL` | no       |                         | Enables the PostgreSQL tests (see Tests)     |

## Environment variables (`client/.env.local`)

| Variable       | Required | Default                 | Description                                        |
| -------------- | -------- | ----------------------- | -------------------------------------------------- |
| `VITE_API_URL` | no       | `http://localhost:3000` | API base URL (public: it's built into the JS bundle) |
