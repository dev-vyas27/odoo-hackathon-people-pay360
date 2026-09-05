# PeoplePay360 — QA Report

**Branch:** `feature/hr-operations` · **Nothing committed** · **Date:** 2026-09-05

**Method.** Playwright + Chromium against a **production build** (`next build && next start`).
161 end-to-end tests across all ten modules: API contract and validation testing, business-rule
and state-machine testing, RBAC and injection testing, plus browser journeys for every screen.

**No seeded data was used.** Every employee, department, job position, schedule, contract,
attendance record, leave type, allocation, leave request, salary rule, salary structure and payrun
in this run was created by the tests themselves through the public API. The only pre-existing
record is the QA login, because the application deliberately has no self-registration —
`tests/e2e/global-setup.ts` bootstraps it idempotently via the team's own `create-admin` script.

## Result

| | Before | After |
|---|---|---|
| E2E tests passing | 101 / 147 | **161 / 161** |
| Unit tests | 300 / 300 | **309 / 309** |
| Typecheck + lint | clean | clean |

**Nine defects found and fixed. One was demo-fatal.** Two consecutive full runs are green, so the
suite is idempotent and safe to re-run.

---

## Findings

### F1 — Login is impossible on a production build over HTTP · **High**

`lib/auth.ts` set `secure: process.env.NODE_ENV === 'production'` on the session cookie. Served over
plain HTTP — `npm run build && npm start` on a laptop, which is how a demo usually gets shown — the
browser silently discards a `Secure` cookie. Login returns **200**, then the app bounces straight
back to `/login`. Nothing errors, nothing logs, so it reads as "the password is wrong".

**First attempt, rejected on security review.** Deriving the flag from `x-forwarded-proto` (falling
back to `origin`/`referer`) looked obvious and was wrong. Plenty of reverse proxies **append** to a
client-supplied `X-Forwarded-Proto` rather than replacing it, so the leftmost value — the one that
reads as the original scheme — is whatever the caller sent. A victim's request carrying
`x-forwarded-proto: http` arrives as `http,https`, the code reads `http`, and that session's cookie
is issued **without** `Secure`, exposing it to interception. `origin` and `referer` are worse: freely
set by the caller and no evidence of transport security at all.

**Fix as shipped.** Configuration only — no request header touches the decision:

| `COOKIE_SECURE` | Result |
|---|---|
| `true` | always `Secure` |
| `false` | never — a local HTTP demo, opting out knowingly |
| unset | `Secure` in production, open in development |

The default is the safe one, so forgetting the variable in a real deployment cannot silently
downgrade anyone; Render and Vercel need no configuration. Documented in `.env.example`, and the QA
harness opts out explicitly in `playwright.config.ts` exactly as a local demo would.

Pinned by 5 unit tests over the branches (`lib/auth.test.ts`) plus 3 E2E tests, two of which assert
that a spoofed `x-forwarded-proto` changes the flag in **neither** direction.

### F2 — Every validation error in three modules was a 500 · **High**

Route handlers in `contracts`, `schedules` and `attendance` (7 files) called `schema.parse()`
directly. A `ZodError` is not a `DomainError`, so `handle()` fell through to the 500 branch. A blank
schedule, a bad time, a wage of `-1`, an end date before a start date — all **500 Internal Server
Error**, with no field-level detail for the form to display. `people` and `timeoff` were unaffected
because they bridge through `parseWith`.

**Fix.** `handle()` in `lib/http.ts` now translates a `ZodError` into the same
`400 VALIDATION_ERROR` envelope with `details.issues[]` that `parseWith` produces. One change at the
single HTTP choke point fixes all seven routes and any future route written in either style.

### F3 — Contract and schedule lists silently ignored every filter · **High**

Both used `pageQuerySchema.parse(parseQuery(url))`. That schema describes only paging keys, so
parsing with it **discarded every other query parameter**. `GET /api/contracts?employeeId=X`
returned the entire table — measured: 28 rows filtered, 28 rows unfiltered. Silent, so the UI
looked like it worked while showing everyone's contracts on one employee's screen.

**Fix.** Use `parsePageQuery`, which keeps non-paging keys as `filters` for
`BaseSqlRepository.buildWhere`.

### F4 — The shared `money` validator rejected nothing · **Medium**

```ts
.refine((n) => Number.isInteger(Math.round(n * 100)), 'At most 2 decimal places')
```

`Math.round` always returns an integer, so the predicate was constant-true. A wage of `100.123` was
accepted, then rounded on write — a silent payroll data-quality hole affecting every `money` field
in the app.

**Fix.** Compare the scaled value against its own rounding with a float tolerance. `100.123` is now
rejected; `100.12` still passes (`100.12 * 100` is `10011.999999999998`, which an exact comparison
would wrongly reject).

### F5 — Attendance returned the raw domain aggregate, crashing its own screen · **High**

`private props` is a TypeScript-only marker; at runtime it is an own enumerable property. Every
attendance response serialised as `{ attendance: { props: { … } } }`, leaking the aggregate's
internals as the public wire format. Worse, `ListAttendanceUseCase` returned `Paged<Attendance>`,
which carries **no `status` and no `workedHours`** — so `/attendance` died in the browser with
`Cannot read properties of undefined (reading 'replace')` from `StatusBadge`.

The DTO (`AttendanceListItem`) and the mapper (`toDomainStatus`) both already existed. Nothing
called them.

**Fix.** `findMany` now returns `AttendanceRecord { attendance, status }` — which is exactly what the
port's own doc comment always said it stored the status for — and the route maps that onto
`AttendanceListItem`. Added `toJSON()` to the aggregate so the internals can never reach the wire
again.

### F6 — Payroll compute crashed. The headline feature had never worked. · **Critical**

`POST /api/payruns/:id/compute` returned **500**:
`column "sequence" is of type integer but expression is of type text`.

In `SELECT … FROM (VALUES …) AS v(…)`, Postgres has no target column to infer parameter types from,
so every `$n` binds as `text`. This is unconditional — **not an edge case**. Payroll computation has
never succeeded through the API. The 20 payslips in the database came from the seed script writing
SQL directly, which is why it was never noticed.

This is scenario A of the five-minute demo.

**Fix.** Write the VALUES directly under the INSERT (repeating `$1` for the payslip id) so each
parameter takes its target column's type. Verified end to end: create employee → contract →
structure → payrun → compute → validate → mark paid now passes, with correct line amounts.

### F7 — Night shifts could not be recorded · **Medium**

`worked-hours.service.ts` documents and unit-tests midnight-crossing shifts (23:00 → 06:00 = 7
hours). But the aggregate stored the raw check-out timestamp, and the schema's
`attendances_checkout_after_checkin` CHECK constraint rejected it. Domain and database disagreed;
the feature was unusable end to end despite passing its unit tests.

**Fix.** Roll the check-out to the following day when it precedes the check-in. That is not a
workaround for the constraint — it is what actually happened. The constraint was right; the stored
value was wrong.

### F8 — Dangling references surfaced as 500s with constraint names · **Medium**

Posting a contract or attendance record for a non-existent employee produced a 500 containing
`contracts_employee_id_fkey`. Unhelpful, and a small schema-information leak. `timeoff` and `people`
mapped Postgres codes themselves; `employment` and `attendance` mapped none.

**Fix.** A last-resort translator in `handle()` maps the common SQLSTATE codes (`23505`, `23503`,
`23502`, `23P01`, `23514`, `22P02`) to proper domain errors. Repositories that map a specific
constraint with a better message still win — this never sees those.

### F9 — One odd payrun made the whole payrun list unreadable · **Medium**

Found while merging `users` into `employees`. `PostgresPayrunRepository.toDomain` called
`createPayrun` on every read, so a **create-time** invariant ran against rows that already existed.
A payrun whose last employee had been removed threw `PAYRUN_NO_EMPLOYEES` on load — and because the
list maps every row through it, one such row made *every other payrun* unreadable and the screen
rendered an error state instead.

Same shape as F5: a write-time rule leaking onto a read path.

**Fix.** Split `reconstitutePayrun` (trusted, rebuilds from storage) from `createPayrun` (validates),
exactly as `Attendance.reconstitute()` is split from `Attendance.checkIn()`, and point the
repository at the former. Pinned by 4 unit tests.

---

## Verified working — no action needed

These were tested hard and hold up. Worth knowing before an evaluator probes them.

- **Injection.** `?sort=name;DROP TABLE users--` falls back to the default sort; `?search` with
  quotes, `--` and `%` wildcards is bound, not interpolated. The `columns` allowlist does its job.
- **Auth.** A forged signature and an `alg=none` token are both refused. Anonymous access to all 12
  protected collections returns `401` JSON, never HTML.
- **RBAC.** A plain `employee` cannot create employees, read salary rules, or list users (403 each).
  Row-level scoping blocks reading another employee's attendance.
- **Open redirect.** `?next=https://evil.example` and `?next=//evil.example` are both refused.
- **Time Off state machine.** draft → submit → approve deducts balance correctly. Approving a draft
  is `422 LEAVE_ILLEGAL_TRANSITION`. A refused request cannot be approved. Overlapping requests are
  `409 LEAVE_OVERLAP`. Insufficient balance and missing allocation are distinct, correct errors.
- **Pending vs taken.** A submitted request shows `taken: 0, pending: 3, remaining: 7` — exactly the
  documented semantics.
- **Payrun state machine.** A draft cannot be marked paid; a validated run cannot be recomputed.
- **Period-correct contract resolution.** A June-2024 payrun uses the 2024 contract, not the 2025
  raise. The most important rule in the system, confirmed against real rows.
- **Contract overlap prevention** and **duplicate-email rejection** both hold.
- **Dashboard** figures are live: creating an employee moves headcount; a missing bank account
  raises the operational alert; average salary agrees with the totals beside it; the trend is
  gap-filled to 12 months.
- **Server-derived values.** `weeklyHours` is computed and a client-supplied value is ignored.
- **All 7 screens** render with zero console errors and no server exceptions.

---

## Open items — not fixed, deliberately

1. **Run a production build with `COOKIE_SECURE=false` for a local HTTP demo.** Without it the
   session cookie is `Secure`, the browser discards it, and login appears to succeed while never
   sticking (finding F1). Deployments behind TLS need nothing.
2. **`npm run seed -- --reset` deletes every row in the seeded tables, `users` included.** This bit
   mid-run: a teammate reseeded and the QA account vanished, making 46 tests fail with a 401 that
   looked like an auth bug. Not a code defect — the reset is opt-in — but **do not run it after
   accounts are created for the demo**, or you will delete the logins you are about to present with.
3. **`next dev` cannot boot its client runtime in this environment.** The Turbopack HMR websocket
   fails to handshake (`ERR_INVALID_HTTP_RESPONSE`), nothing hydrates, and the login form falls back
   to a native GET that puts the password in the URL. The **production build is unaffected** — it
   hydrates correctly and the handler runs. Two consequences: run the demo from `npm run build &&
   npm start`, and note that the login form has no non-JS fallback, so if hydration ever fails the
   password lands in browser history. Adding `method="post"` to the form would close that.
4. **Paging validation is inconsistent.** `pageQuerySchema` *rejects* `?limit=300` and `?page=0`
   with a 400, while `normalizePageQuery` *clamps* the same values. Both are defensible; they should
   agree. Low severity — a stale bookmark or a "next page" past the end returns 400 rather than
   page 1.
5. **`modules/delivery` remains unimplemented** — no payslip PDF, no bulk email. Unchanged from the
   architecture doc.
6. **List-view status fidelity.** Now correct (the stored `status` is returned), but note that
   `late` / `overtime` depend on the schedule resolved at write time. Attendance created before a
   schedule is attached will read `present`.

## Suggested order of work

| Priority | Item |
|---|---|
| Done | F6 payroll compute — was demo-fatal |
| Done | F1, F2, F3, F5 — user-visible breakage |
| Done | F4, F7, F8, F9 — data quality and error contract |
| Next | Re-run the demo script end to end from a production build |
| Next | Open items 1 and 2 — set COOKIE_SECURE for the demo; nobody reseeds after accounts exist |
| Later | Open items 3, 4 — hardening, not blockers |

## Running the suite

```bash
npm run build                 # the suite runs against a production build
npx playwright test           # 161 tests, ~1 minute
npx playwright test --ui      # interactive
```

`tests/e2e/global-setup.ts` creates the QA account if it is missing, so the suite is safe to run on
a freshly reset database. `tests/e2e/09-regressions.spec.ts` holds one test per defect above — if
one goes red, the regression is exact and the entry here explains the history.
