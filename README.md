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
cp .env.example .env   # then edit STYLE_WORK_DB_URL (and CORS_ORIGIN if needed)
npm run db:schema      # create the leads table (safe to re-run)
npm run dev            # http://localhost:3000
```

Check it's running: <http://localhost:3000/api/health> should return `{"status":"ok"}`.

The server connects to PostgreSQL on startup and exits with an error if `STYLE_WORK_DB_URL`
is missing or the database is unreachable.

### 2. Frontend

```bash
cd client
npm install
npm run dev            # http://localhost:5173
```

In development the frontend calls the API at `http://localhost:3000`; production builds call
`/api` on their own origin (a reverse proxy forwards it to the server). To use a different URL,
copy `client/.env.example` to `client/.env.local` and set `VITE_STYLE_WORK_API_URL`.

## Backend scripts (`server/`)

| Script               | What it does                                    |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Start the API with auto-reload (tsx watch)      |
| `npm run build`      | Compile TypeScript to `dist/`                   |
| `npm start`          | Run the compiled server (`dist/index.js`)       |
| `npm run typecheck`  | Type-check all TypeScript without emitting      |
| `npm test`           | Run the test suite once                         |
| `npm run test:watch` | Run tests in watch mode                         |
| `npm run db:schema`  | Apply `db/schema.sql` to `STYLE_WORK_DB_URL`     |

## API

| Method  | Path                                                  | Body                     | Success                          |
| ------- | ----------------------------------------------------- | ------------------------ | -------------------------------- |
| `GET`   | `/api/health`                                         |                          | `200 {"status":"ok"}`            |
| `GET`   | `/api/leads?search=term&status=new&page=1&limit=20`   |                          | `200` a page of leads, newest first |
| `POST`  | `/api/leads`                                          | `{ name, email, phone }` | `201` created lead               |
| `PATCH` | `/api/leads/:id`                                      | `{ status }`             | `200` updated lead               |

All `GET /api/leads` parameters are optional and can be combined:

| Parameter | Default | Description                                                  |
| --------- | ------- | ------------------------------------------------------------ |
| `search`  |         | Matches name, email or phone (case-insensitive), max 100 chars |
| `status`  |         | Only leads with this status                                  |
| `page`    | `1`     | 1-based page number                                          |
| `limit`   | `20`    | Leads per page, 1–100                                        |

It returns the page plus the total number of matching leads, so clients can render page
links: `{ "leads": [...], "total": 57, "page": 1, "limit": 20 }`. A page past the end returns
an empty `leads` array with the real `total`.

Pagination uses `LIMIT`/`OFFSET`, so any page number can be linked directly. The trade-off:
deep pages get slower, and a lead added between two page loads shifts the rest by one.
Keyset (cursor) pagination avoids both, but it can't jump to page N, so it would suit
infinite scroll better than numbered pages.

New leads start with status `new`; valid statuses are `new`, `contacted`, `qualified`,
`converted`, `lost`.

A lead looks like:

```json
{
  "id": 1,
  "name": "Asha Rao",
  "email": "asha@example.com",
  "phone": "+91 98765 43210",
  "status": "new",
  "createdAt": "2026-09-23T10:15:00.000Z",
  "updatedAt": "2026-09-23T10:15:00.000Z"
}
```

Errors return `{ "error": "message" }`, plus a `details` object with per-field messages on
validation errors: `400` invalid input, `404` lead not found, `409` email already exists,
`413` body over 10 kB, `429` rate limit exceeded.

## Frontend behaviour

- The search term, status filter, page and page size live in the URL
  (`?search=asha&status=new&page=2&limit=50`), so a reload or a shared link shows the same
  view. The URL is updated with `history.replaceState`, so paging doesn't fill the back
  button's history. Invalid values in a hand-edited link fall back to the defaults.
- Changing the search, filter or page size goes back to page 1. A link to a page past the end
  (or removing the last lead on the last page) moves to the last page that exists.
- Adding a lead jumps to page 1, where it appears as the newest lead.
- Status changes update the row in place. When a status filter is active and the lead no
  longer matches it, the page is refetched so it refills from the next page.

## Security

- **SQL injection:** every query is parameterized (`$1`, `$2`, …); user input is never
  concatenated into SQL. `LIKE` wildcards in search terms are escaped.
- **Input validation:** all request bodies, ids and query strings are validated and
  length-limited on the server; JSON bodies are capped at 10 kB.
- **Rate limiting (per client IP):** 300 requests and 50 writes (`POST`/`PATCH`) per
  15 minutes, applied globally. The health check is exempt so platform probes are never throttled.
  `X-Forwarded-For` is only trusted when `TRUST_PROXY` is set, so clients can't spoof their
  IP to reset their quota.
- **HTTP hardening:** security headers via `helmet` (HSTS, `nosniff`, CSP, frame
  protection); CORS limited to configured origins and the `GET`/`POST`/`PATCH` methods.
- **Error handling:** unexpected errors are logged server-side and return a generic `500`,
  never stack traces or database details.
- **Database:** secrets live only in environment variables; row level security blocks
  Supabase's public REST API from reading the table; connections time out after 5 s.

## Database

The schema lives in [`server/db/schema.sql`](server/db/schema.sql): a single `leads` table with
an identity primary key, non-blank `name`/`email`/`phone`, a `status` limited by a CHECK
constraint (default `new`), `created_at`/`updated_at` timestamps, and a case-insensitive unique
index on email. A `(status, created_at DESC)` index serves the status filter together with the
newest-first sort. A `BEFORE UPDATE` trigger sets `updated_at` whenever a row actually changes,
so it stays accurate even for updates made outside the API (e.g. in the Supabase dashboard).
Apply it with `npm run db:schema`, or paste it into the Supabase SQL Editor. Re-running it
upgrades an existing table in place: `updated_at` is added and backfilled from `created_at`.

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
| `tests/leads.validation.test.ts`   | Email, phone, id, search, status filter, page and limit validation rules | no     |
| `tests/security.test.ts`           | Security headers, CORS, body size limit, per-IP rate limits, `X-Forwarded-For` spoofing | no |
| `tests/leads.repository.test.ts`   | The real SQL: create, duplicates, search, status filter, pagination and totals, ordering, updates and the `updated_at` trigger | yes |

The repository tests run only when `TEST_DATABASE_URL` is set, and are skipped otherwise.
They create a temporary schema, apply `db/schema.sql` to it and drop it afterwards, so
`TEST_DATABASE_URL` can safely be the same database as `STYLE_WORK_DB_URL`. Tests never use
`STYLE_WORK_DB_URL` itself.

### Frontend (`client/`)

React Testing Library in a jsdom environment. The API module and toasts are mocked, so no
server is needed.

| File                                   | Covers                                                           |
| -------------------------------------- | ---------------------------------------------------------------- |
| `src/api.test.ts`                      | Request URLs, methods, JSON bodies and error handling            |
| `src/leadQuery.test.ts`                | Reading and writing the URL query, fallbacks for invalid values  |
| `src/components/Pagination.test.tsx`   | Page links with gaps, disabled previous/next, page size changes  |
| `src/components/LeadForm.test.tsx`     | Create flow, per-field server errors, duplicate email, toasts    |
| `src/components/LeadTable.test.tsx`    | Rows, links and timestamps, status changes, disabled select while saving |
| `src/App.test.tsx`                     | Loading, debounced search, status filter, pagination and URL state, empty/error states, status updates, "Add a lead" accordion |

## Environment variables (`server/.env`)

| Variable            | Required | Default                 | Description                                  |
| ------------------- | -------- | ----------------------- | -------------------------------------------- |
| `STYLE_WORK_DB_URL` | yes      |                         | PostgreSQL connection string                 |
| `PORT`              | no       | `3000`                  | Port the API listens on                      |
| `CORS_ORIGIN`       | no       | `http://localhost:5173` | Comma-separated list of allowed origins      |
| `TEST_DATABASE_URL` | no       |                         | Enables the PostgreSQL tests (see Tests)     |
| `TRUST_PROXY`       | no       | unset                   | Number of reverse proxies in front of the API (`1` on Render) |

## Environment variables (`client/.env.local`)

| Variable                  | Required | Default                                          | Description                                        |
| ------------------------- | -------- | ------------------------------------------------ | -------------------------------------------------- |
| `VITE_STYLE_WORK_API_URL` | no       | `http://localhost:3000` in dev, same origin in production | API base URL (public: it's built into the JS bundle) |
