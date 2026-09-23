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

## Backend scripts (`server/`)

| Script               | What it does                                    |
| -------------------- | ----------------------------------------------- |
| `npm run dev`        | Start the API with auto-reload (tsx watch)      |
| `npm run build`      | Compile TypeScript to `dist/`                   |
| `npm start`          | Run the compiled server (`dist/index.js`)       |
| `npm run typecheck`  | Type-check `src/` and `tests/` without emitting |
| `npm test`           | Run the test suite once                         |
| `npm run test:watch` | Run tests in watch mode                         |
| `npm run db:schema`  | Apply `db/schema.sql` to `DATABASE_URL`         |

## Database

The schema lives in [`server/db/schema.sql`](server/db/schema.sql): a single `leads` table with
an identity primary key, non-blank `name`/`email`/`phone`, a `status` limited by a CHECK
constraint (default `new`), a `created_at` timestamp, and a case-insensitive unique index on
email. Apply it with `npm run db:schema`, or paste it into the Supabase SQL Editor.

## Environment variables (`server/.env`)

| Variable       | Required | Default                 | Description                                  |
| -------------- | -------- | ----------------------- | -------------------------------------------- |
| `DATABASE_URL` | yes      |                         | PostgreSQL connection string                 |
| `PORT`         | no       | `3000`                  | Port the API listens on                      |
| `CORS_ORIGIN`  | no       | `http://localhost:5173` | Comma-separated list of allowed origins      |
