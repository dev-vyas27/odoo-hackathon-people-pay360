# Dev A — Platform, Identity, Time Off, Delivery & Analytics

> **You are the enabler.** The other two developers are blocked until your kernel lands.
> Everything in Phase 1 is a dependency for someone else. Ship it fast, ship it rough,
> refine later. Your own features (Time Off, PDF, Dashboard) come *after*.

**Modules you own:** `shared` · `identity` · `timeoff` · `delivery` · `analytics`

**Files nobody else may edit:** `lib/*`, `proxy.ts`, `app/layout.tsx`, `app/globals.css`,
`components/ui/*`, `components/resource/*`, `eslint.config.mjs`, `modules/shared/**`

---

## 0. Ground rules (all three of us)

| Rule | Why |
|---|---|
| Import other modules **only** from `@/modules/<name>` | ESLint blocks reaching into `domain/`, `application/`, `infrastructure/`. It fails your lint, not just your conscience. |
| `domain/` and `application/` never import `next/*`, `pg`, `react`, `@/lib/*` | Enforced by ESLint. This is what makes the logic testable in milliseconds. |
| `await params`, `await searchParams`, `await cookies()` | Next 16 removed synchronous access. Non-negotiable. |
| Route handlers stay about 5 lines | Parse, call use case, `respond(result)`. Logic lives in `application/`. |
| Money is **never** a float | Use `Money` from `@/modules/shared`. |
| Run `npm run verify` before every push | typecheck + lint + tests. |
| **Every form uses react-hook-form + zod** | Use `ResourceForm` from `@/components/resource/resource-form`. No `useState` forms, no manual validation. Define the zod schema once in the module's `interface/` folder and import it into **both** the form and the route handler so client and server cannot drift. |
| **Icons come from `react-icons` only** | `lucide-react` is removed. Use `react-icons/lu` for the Lucide glyph set (identical artwork) or any other `react-icons` pack. Adding `lucide-react` back will be rejected in review. |

**Status legend:** `P0` demo breaks without it · `P1` judged on it · `P2` cut first if behind.

---

## Phase 1 — H0 to H4 · Unblock everyone `P0`

The other two are idle-ish until this lands. Nothing here is allowed to be pretty.

### H0–H1 — Contract hour (all three of us, together, out loud)

Sit together. Write **only** type signatures, no implementations. Output:

- `modules/shared/contracts/dto.ts` — every DTO that crosses a module boundary
- The port interfaces each module *publishes* (Dev B and Dev C list theirs in their plans)
- Confirm the event union in `modules/shared/domain/domain-event.ts` covers what you each need

After this hour nobody blocks anybody, because everyone codes against interfaces.

### H1–H2 — Identity `P0`

```
modules/identity/
  domain/user.ts                    User entity; the password hash is never exposed
  application/
    ports/user-repository.port.ts
    login.use-case.ts               email + password -> TokenPayload
    create-user.use-case.ts
  infrastructure/
    user.table.ts                   row shape + column list
    postgres-user.repository.ts     parameterised SQL
  interface/auth.controller.ts
  index.ts
```

Routes: `app/api/auth/login/route.ts`, `logout/route.ts`, `me/route.ts`.
Use `signToken` and `setAuthCookie` from `@/lib/auth` — already written and working.

> `proxy.ts` is already written and wired. It verifies the JWT and applies section-level
> role checks. Do **not** put row-level rules there — those belong in use cases via
> `authorizeOwned()`.

### H2–H3 — App shell and navigation `P0`

```
app/(auth)/login/page.tsx
app/(dashboard)/layout.tsx          top nav, current user, role-aware menu
components/layout/top-nav.tsx       hides links the role cannot read
components/layout/user-menu.tsx
app/forbidden/page.tsx
```

Nav items exactly as spec section B1: Employees · Contracts · Attendance · Time Off ·
Payroll · Reports.

Gate every link with `can(role, resource, 'read')` — the same table the API uses, so the
UI and the API can never disagree about who sees what.

### H3–H4 — The CRUD kernel `P0` — this is the whole plan's leverage

`ResourceTable`, `StatusBadge`, `PageHeader` and `SmartButton` already exist. Add:

```
components/resource/
  resource-form.tsx      config-driven form (field list -> react-hook-form + zod)
  filter-bar.tsx         search + select filters, writes to searchParams
  pagination.tsx
  confirm-dialog.tsx
  wizard-shell.tsx       multi-step shell — Dev C needs this for the Payrun wizard
hooks/
  use-resource.ts        TanStack Query list/get/create/update/delete for /api/<resource>
```

Also add `app/providers.tsx` with the TanStack `QueryClientProvider` and mount it in the
dashboard layout.

**Announce in the group chat the moment `use-resource` and `resource-form` land.** Dev B
and Dev C's velocity roughly triples at that exact moment — it is the single most
schedule-critical event of the whole 24 hours.

---

## Phase 2 — H4 to H10 · Time Off vertical `P0`

Your own bounded context. Three aggregates, one genuinely interesting algorithm.

```
modules/timeoff/
  domain/
    time-off-type.ts        units day|hour, requires_allocation, is_paid
    allocation.ts           AGGREGATE ROOT: allocated, taken, remaining, validity Period
    leave-request.ts        AGGREGATE ROOT
    leave-request-state.ts  State pattern: draft -> to_approve -> approved | refused
    balance.service.ts      PURE consumption maths — unit-test this hard
  application/
    ports/employee-lookup.port.ts     consumed from Dev B
    request-leave.use-case.ts
    approve-leave.use-case.ts         publishes LeaveRequestApproved
    refuse-leave.use-case.ts
    allocate.use-case.ts
    get-balance.use-case.ts
  infrastructure/   tables, repositories, adapter implementing employee lookup
  interface/        controllers, zod schemas
```

**The rule that must not break:** approving a request whose type has
`requires_allocation` deducts from the matching allocation, and **fails** when the balance
is insufficient. Approval and deduction live in one use case so they cannot drift apart.

Screens: `app/(dashboard)/time-off/{requests,allocations,types}/` — list plus form each,
built from your own kernel. If a screen is slow to build, fix the kernel rather than
hand-rolling the screen; you will need that fix three more times.

Tests `P1`: balance consumption, over-draw rejection, refuse-after-approve restoring
balance, allocation validity window excluding out-of-range requests.

---

## Phase 3 — H10 to H14 · Integration #1 `P0`

- Replace your stubbed `EmployeeLookupPort` with Dev B's real adapter.
- Subscribe `analytics` handlers to the event bus.
- **Own the merge.** You wrote the shared files, so you resolve conflicts in them. Do a
  three-way sync at H10 and again at H14: everyone pushes, you integrate, you shout early
  if something broke.

---

## Phase 4 — H14 to H18 · Delivery and Dashboard

### Delivery `P0`

```
modules/delivery/
  domain/payslip-document.ts        pure layout description, no pdfkit import
  application/
    ports/payslip-query.port.ts     consumed from Dev C
    generate-payslip-pdf.use-case.ts
    send-payslips.use-case.ts
  infrastructure/
    pdfkit-renderer.ts              the ONLY file importing pdfkit
    nodemailer-mailer.ts            the ONLY file importing nodemailer
```

Routes: `GET /api/payslips/[id]/pdf` streaming `application/pdf`, and
`POST /api/payruns/[id]/send`.

Keeping the renderer behind a port means the layout is describable and testable without
generating a single byte of PDF, and swapping pdfkit for something else later touches one
file.

Bulk email: send sequentially with a small delay, collect per-employee results, return a
summary. **Never** fail the whole batch because one address bounced.

### Analytics / Payroll Dashboard `P1` — the screen judges look at longest

```
modules/analytics/
  application/
    ports/employee-stats.port.ts      from Dev B
    ports/attendance-stats.port.ts    from Dev B
    ports/leave-stats.port.ts         yours
    ports/payroll-stats.port.ts       from Dev C
    get-dashboard.use-case.ts         composes all four, applies the filters
  interface/dashboard.controller.ts
```

Route `GET /api/dashboard?period=&department=&employeeType=`, screen
`app/(dashboard)/reports/page.tsx`.

Build in this order — each step is independently demoable:

1. `P0` KPI cards — Total Net Salary Paid, Payslips Generated, Average Salary, Approved Time Off, Attendance Health
2. `P1` Charts — Salary Cost by Department, Monthly Net Salary Trend
3. `P1` Operational alerts — missing bank details, duplicate payslips, contract attention items
4. `P2` Attendance overview — present, late, absent, overtime, missing check-outs
5. `P2` Department breakdown — headcount plus total spend

> Every number must come from a real aggregation. A hardcoded chart is the fastest way to
> lose credibility in a demo, and the spec calls this out explicitly in section 7.

Use `--color-chart-1` through `--color-chart-5` from `globals.css`. Do not introduce new hues.

---

## Phase 5 — H18 to H24 · Seed, freeze, rehearse `P0`

### `scripts/seed.ts` — you own this, and it decides how good the demo looks

Deterministic (fixed seed), idempotent (`--reset` flag), and rich enough to make the
dashboard interesting:

- 5 users, one per role, obvious passwords, printed to the console at the end
- 3 departments, 6 job positions, 2 working schedules (40h standard, 20h part-time)
- About 25 employees spread across departments and employee types
- Contracts including **one employee with an expired contract plus a current one** — this
  is what proves period-based contract selection live on stage
- 60 days of attendance with deliberate anomalies: 2 missing check-outs, 3 late, 1 overtime
- Time off types (Paid, Sick, Unpaid), allocations, and a mix of approved and pending requests
- One **fully paid historical payrun** so the dashboard has trend data on first load
- One **draft payrun** staged and ready for the live compute demo

Seed data is not busywork. It is the difference between a dashboard that looks alive and
one that looks broken.

### Remaining hours

- `H18` Integration freeze. No new features, bug fixing only.
- `H19–H21` Full rehearsal of both required scenarios, end to end, out loud, timed.
- `H21–H23` Bug bash. You triage, because you are the one who sees every module.
- `H23–H24` Two timed run-throughs plus the future-roadmap summary (a spec deliverable).

---

## Definition of done

- [ ] `npm run verify` green
- [ ] `npm run seed` produces a demo-ready database from empty
- [ ] Every role logs in and sees exactly the right nav items
- [ ] Payslip PDF downloads; bulk send reports per-recipient results
- [ ] Dashboard numbers actually change when the filters change
- [ ] Both demo scenarios rehearsed inside five minutes
