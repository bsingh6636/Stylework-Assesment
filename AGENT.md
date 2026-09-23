# AI usage (AGENT.md)

AI tools were allowed for this assignment and were used heavily. This file records which tools
were used, how, what they produced, and where their output had to be corrected.

## Tools

- **Claude Code** (Anthropic's terminal coding agent) wrote most of the code, tests and
  documentation, ran the test suites, type checker and linter, and reviewed the running app by
  driving a headless Chrome browser.
- Near the end, two Claude Code sessions worked in parallel. One built pagination, the site
  header, the demo-data seed script, deleting leads and the loading states. The other did a review pass, the search and validation
  fixes, the responsive table and the documentation. To avoid overwriting each other's work, the
  sessions messaged each other which files each was editing before touching them.

## Workflow

1. The assignment was split into small steps, each meant to become one commit: scaffold →
   schema → repository → routes and validation → API tests → list and search → form and status
   updates → client tests → comment cleanup → security hardening → status filter, `updated_at`
   and pagination → review fixes → documentation → site header, demo-data seed script and
   deleting leads.
2. For each step the agent wrote the code and its tests, and ran typecheck, lint and tests.
3. I (the developer) read the diff, ran the app locally, asked for changes where needed, then
   wrote the commit message and committed. The agent never committed or pushed.

## Prompts

Quoted prompts are as typed, with spelling fixed; the rest are paraphrased.

| # | Prompt | Outcome |
| - | ------ | ------- |
| 1 | Build the Lead Tracker from the assignment brief with a React + TypeScript client, an Express + TypeScript API and PostgreSQL through `pg` without an ORM, one step per commit. *(paraphrased)* | Step plan and project scaffold |
| 2 | "Please just write code for me." (I had first planned to write the SQL myself.) | Schema and repository SQL written by the agent |
| 3 | Should I use shadcn/ui? *(paraphrased)* | Agent advised plain CSS, since Tailwind and component config was churn for four screens' worth of UI; kept plain CSS |
| 4 | Show toast notifications for success and errors. *(paraphrased)* | `sonner` toasts |
| 5 | "Remove comments, keep comments only where required." | Comment cleanup commit; the rule was followed afterwards |
| 6 | The reviewer checks security and code quality, not just whether it works; harden it. *(paraphrased)* | `helmet`, CORS allowlist, per-IP rate limits, body size limit, safe error responses |
| 7 | Add a status filter, an updated-at timestamp and pagination. *(paraphrased)* | `?status=`, trigger-maintained `updated_at`, numbered pages with URL state |
| 8 | "It's an assessment project for hiring, is anything missing? They have allowed AI, so any missing edge cases or similar? What do you say about the UI? Can you access a browser?" | Review with a headless browser and edge-case API probes (findings below) |
| 9 | "Update AGENT.md, update the README and anything that is not updated. Fix bugs related to name and phone search. Nice UI." | Search and validation fixes, responsive table, form focus handling, these docs |
| 10 | Add a header with the company name on the left and "View my portfolio" and my GitHub profile on the right, plus the Stylework favicon. *(paraphrased)* | `SiteHeader` component; the favicon was taken from stylework.city |
| 11 | "Also give option to delete lead, also create script to create random 100 data." | `DELETE /api/leads/:id` behind a confirmation dialog; `npm run db:seed` |
| 12 | "Review all changes, push changes in 2 commits." Then: "Also add proper loader states for table, search, add, delete and all", and "better loading and skeleton wherever we can use". | Review of both sessions' changes; skeleton table, progress bar, busy search, read-only form while saving, status and delete spinners |

## What was AI-generated and what was done by hand

| Area | AI-generated | By hand |
| ---- | ------------ | ------- |
| Database schema, SQL queries, routes, validation, middleware | Yes | Reviewed, and run against a real Supabase database |
| React components, hooks and CSS | Yes | Reviewed in the browser, with UI decisions such as the collapsible form and toasts |
| Server and client tests | Yes | Run locally, including the PostgreSQL tests |
| README.md and AGENT.md | Drafted from the code and session history | Reviewed and corrected |
| Scope and step plan, feature choices | Options proposed | Decided |
| Supabase project, credentials, `.env` values, env var naming (`STYLE_WORK_DB_URL`) | | Yes |
| Commit history: splitting, messages, pushing | | Yes |
| Deployment | Steps documented | Yes |

## Key engineering decisions

- **Three thin layers on the server.** Routes only parse, call and map errors; validation turns
  untrusted input into typed values; the repository owns all SQL. Each layer is tested on its
  own: validation as pure functions, routes with a mocked repository, and SQL against a real
  database.
- **Plain parameterized SQL through `pg`.** Four queries don't need an ORM, and every query stays
  readable. The id is `INTEGER` rather than `BIGINT`, because `pg` returns `BIGINT` as a string.
- **Rules enforced in the database too.** A case-insensitive unique index on `lower(email)`
  (mapped to a `409`), a CHECK on `status`, non-blank CHECKs, and a `BEFORE UPDATE` trigger for
  `updated_at` that also covers edits made in the Supabase dashboard and skips no-op updates.
  Row level security is enabled so Supabase's auto-generated REST API can't read the table.
- **Server-side validation as the single source of truth.** The client shows the API's
  per-field messages instead of keeping a second copy of the rules.
- **Input normalization.** Text is NFC-normalized, whitespace is collapsed, zero-width
  characters are trimmed and control characters are rejected. This came out of the review,
  which found a NUL byte could cause a `500`.
- **Search that matches how people type.** Every word must match, in any order, and phone-like
  terms also match on digits only, so formatting doesn't matter. The digits rule is limited to
  phone-like terms so that `asha9` doesn't match every phone containing a 9.
- **Security by default.** `helmet` headers, a CORS allowlist, per-IP limits on all requests and
  on writes, `X-Forwarded-For` trusted only when `TRUST_PROXY` is configured, a 10 kB body
  limit, and generic `500` responses.
- **Tests that are safe to run anywhere.** PostgreSQL tests create a temporary schema, verify
  it's active before doing anything, and drop it afterwards, so they can use the development
  database without touching real data.
- **No stale responses on the client.** Each list request is aborted when the query changes. The
  query lives in the URL so views can be shared. Status updates aren't optimistic, so the table
  never shows a status the server didn't save.
- **Deletes are confirmed, then refetched.** A native modal `<dialog>` gives focus trapping and
  Escape handling for free. After deleting, the page is refetched rather than edited locally, so
  it refills from the next page and the total stays right. A `404` (already deleted elsewhere)
  counts as success.
- **Demo data that passes the API's own rules.** The seed script's generator is a pure function
  tested against `parseCreateLeadInput`, uses reserved `example.*` email domains, inserts the
  whole batch in one parameterized statement, and refuses to run with `NODE_ENV=production`.
- **Loading states that don't jump or flash.** The first load shows a skeleton in the table's
  own layout; later loads keep the current rows (dimmed, `aria-busy`) under a progress bar that
  only appears after 150 ms, so the page never collapses to a spinner between pages.
- **Plain CSS with design tokens** and a dark theme, instead of a component library.

## Where AI output needed correcting

- **Too many comments.** The first code restated the obvious; at my request it was cut to
  comments that explain *why* (commit `7e2b3b2`).
- **Deprecated test setup.** The repository tests first set `search_path` with a queued query,
  which `pg` deprecates. They were rewritten to use the pool's `onConnect` hook (commit `9982a28`).
- **Dependency incompatibility.** jsdom 30 needs Node 24.15+, but the dev machine had 24.12, so
  jsdom was pinned to 29.
- **Supabase TLS.** `pg` treats `sslmode=require` as `verify-full`, which rejects Supabase's CA.
  The connection string uses `sslmode=no-verify`, which is documented as a trade-off in the README.
- **Supabase networking.** The direct connection string is IPv6-only, so deployment uses the
  Session pooler.
- **Bugs in AI-written code found by the AI review.** Driving the app in headless Chrome and
  sending unusual input to the API found:
  - one long email pushed the status column (the main action) off-screen;
  - NUL bytes in a field or search returned `500`;
  - phone numbers could be padded with thousands of spaces;
  - searching `9876543210` didn't find `+91 98765 43210`;
  - emails like `a@.b.c` were accepted;
  - a name made only of zero-width spaces was accepted.

  All of these were fixed with regression tests.
- **Unreadable test data.** Two validation tests held invisible characters (zero-width spaces,
  and an accent written as two characters) directly in the source, so they looked like `''` and
  `'José' → 'José'`. The review rewrote them as `\u` escapes.
- **Dark-mode contrast.** Screenshots of the delete dialog showed white text on the dark theme's
  red and blue at about 3:1 contrast, below the 4.5:1 minimum. Filled buttons now use darker
  `--accent-emphasis` and `--danger-emphasis` colours.

## How AI output was verified

- Typecheck, ESLint and both test suites after every step. The server suite includes the real
  PostgreSQL tests.
- Running the app locally and trying each feature in the browser before committing.
- Headless-browser screenshots at desktop, tablet and phone widths, in light and dark mode,
  against a throwaway database schema seeded with test data.
- Reading every diff before committing it.
