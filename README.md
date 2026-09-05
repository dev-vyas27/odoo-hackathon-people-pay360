# PeoplePay360

Integrated HR and payroll operations: employees, contracts, attendance, time off,
and payroll processing.

Built by three developers in parallel. Who owns what is in [`docs/plans/`](docs/plans/);
the schema everyone builds against is [`docs/DATA-MODEL.md`](docs/DATA-MODEL.md).

## Getting started

Requires **PostgreSQL 13+** (tested on 18). The database itself must already
exist — `npm run migrate` creates tables, not the database.

```bash
npm install
cp .env.example .env.local     # then fill in DATABASE_URL and JWT_SECRET
npm run migrate                # apply the SQL schema
npm run dev
```

`http://localhost:3000` redirects to `/login`. There is no sign-up page — this
application never lets anyone register themselves. Create the first account from
the command line:

```bash
npm run create-admin
# or with your own values:
npm run create-admin -- --email you@company.com --password "your password" --name "Your Name"
```

The password is printed once. Re-running with an existing email offers to reset
that account's password rather than failing.

Other roles, for testing what each one can see:

```bash
npm run create-admin -- --email hr@example.com --password "hr-password" --role hr_manager
npm run create-admin -- --email emp@example.com --password "emp-password" --role employee
```

Valid roles: `employee`, `hr_manager`, `hr_payroll_user`, `hr_payroll_manager`, `admin`.

### Demo data

`npm run seed` fills the database with departments, schedules, a few employees,
one account per role, and leave types, allocations and requests. `npm run seed -- --reset` clears those collections
first. It is idempotent — every row has a deterministic UUID from
[`scripts/seed/ids.ts`](scripts/seed/ids.ts) and is written with
`ON CONFLICT (id) DO UPDATE`, so running it twice updates rather than
duplicates. The whole run is one transaction.

The same seed is available as a button on the login screen, behind a flag:

```bash
DEMO_SEED_ENABLED="true"     # in .env.local
```

With it on, `/login` shows a "Load demo data" panel and lists the seeded
accounts — click one to fill the form. With it off (the default), the panel is
gone and `POST /api/demo/seed` returns **404**.

> That endpoint is unauthenticated by necessity: it creates the accounts you
> would need in order to sign in. The flag is the only thing guarding it, so it
> is opt-in, only the exact string `"true"` counts, and it is read on the server
> and never shipped to the browser. Fine for a hackathon cluster; turn it off
> before anything real.

Adding your module's data: write `scripts/seed/parts/<module>.seed.ts` and add
one line to `PARTS` in [`scripts/seed/run.ts`](scripts/seed/run.ts). See
[`scripts/seed/README.md`](scripts/seed/README.md).

## Database

Plain SQL. No ORM: the query in the repository is the query Postgres runs, so
`EXPLAIN` works on text you can copy out of the file.

```bash
npm run migrate              # apply pending migrations
npm run migrate -- --status  # what is applied, what is not
```

Migrations live in [`migrations/`](migrations/), numbered, one domain per file,
applied in filename order and recorded with a checksum. **Never edit an applied
migration** — the runner refuses to continue if one changed, because at that
point the database and the repository disagree. Add a new numbered file.

The schema and the reasoning behind it are documented in
[`docs/DATA-MODEL.md`](docs/DATA-MODEL.md). A fair amount of correctness lives in
the database rather than in application code — a `CHECK` that leave taken cannot
exceed leave allocated, a `UNIQUE` on one attendance row per person per day, and
an `EXCLUDE` constraint making concurrent active contracts impossible rather than
merely discouraged.

## Checking things work

```bash
curl http://localhost:3000/api/health     # separates "app is down" from "Postgres is unreachable"
npm run verify                            # typecheck + lint + tests
```

## Architecture in one screen

```
app/            routes only — handlers are ~5 lines: parse, call use case, respond()
components/     ui/ (generated primitives) · resource/ (the CRUD kernel) · layout/
hooks/          use-resource.ts — TanStack Query bound to the REST convention
lib/            framework adapters: auth, db, http, api-client
modules/        one folder per bounded context
  <name>/
    domain/         entities and pure rules — no next/*, no pg, no react
    application/    use cases and the ports they depend on
    infrastructure/ table definitions, SQL repositories, adapters
    interface/      controllers and zod schemas
    index.ts        the ONLY thing other modules may import
    schemas.ts      client-safe subset: zod schemas, no database
migrations/     numbered .sql files — the authoritative schema
scripts/        migrate, create-admin, seed
```

Three rules the linter enforces so nobody has to remember them:

1. Import other modules only from `@/modules/<name>`. Reaching into `domain/`,
   `application/`, `infrastructure/` or `interface/` fails lint.
2. `domain/` and `application/` may not import `next/*`, `pg`, `react` or
   `@/lib/*`. That is what makes the business logic testable in milliseconds.
3. Every form is react-hook-form + zod, via `ResourceForm`. The schema is defined
   once in the module's `interface/` folder and imported by both the form and the
   route handler, so client and server validation cannot drift.

Two more that the linter cannot check:

- **Import `@/modules/<name>/schemas` from client components**, never
  `@/modules/<name>`. The barrel reaches the Postgres repository; pulling the
  `pg` driver into a browser bundle fails at module evaluation.
- **Money is never a float.** `numeric` in the database, `Money` (integer minor
  units) in the domain.
- **Query values are always `$1, $2, ...`.** Never interpolate a value into SQL.
  Identifiers cannot be bound, so anything generating a column name checks it
  against an allowlist first — see `BaseSqlRepository`.

## Notes for Next.js 16

`middleware.ts` is now [`proxy.ts`](proxy.ts) and the export is `proxy`. It runs on the
Node runtime, so it verifies the JWT properly rather than checking for a cookie's
presence. `params`, `searchParams` and `cookies()` are all async and must be awaited.
