# Seeding

`npm run seed` — deterministic and idempotent. `npm run seed -- --reset` drops
the seeded collections first.

## How to add your part without a merge conflict

One file per owner. `scripts/seed.ts` is a thin orchestrator; the actual data
lives in `scripts/seed/parts/`.

1. Create `scripts/seed/parts/<your-module>.seed.ts` exporting a
   `SeedPart`:

   ```ts
   import type { SeedPart } from '../types'
   import { SEED } from '../ids'

   export const attendanceSeed: SeedPart = {
     name: 'attendance',
     // Dependency order. --reset empties these in reverse.
     tables: ['attendances'],
     async run(ctx) {
       await ctx.upsert('attendances', [
         {
           id: seedId('att', 1),
           employee_id: SEED.employees.demoLead,
           worked_on: '2026-03-02',
           worked_hours: 8,
           status: 'present',
         },
       ])
       ctx.log('1 attendance row')
     },
   }
   ```

   Keys are **column** names (snake_case). A seed writes rows directly, so there
   is no repository in between to translate from the domain's camelCase.

2. Add one line to the `PARTS` array in `scripts/seed/run.ts`.

   Order matters now that foreign keys are real: a part must run after the
   tables it references.

That single line is the entire shared surface. Three people adding three
adjacent lines to one array merges cleanly; three people editing one 300-line
seed function does not.

## Use the fixed ids

Everything references `scripts/seed/ids.ts`. `seedId('emp', 7)` is always
`656d7000-0000-4000-8000-000000000007`, so your payslip can point at Dev B's
employee without coordinating, and re-seeding does not invalidate a URL you had
open.

The whole seed runs in one transaction: either it all lands or none of it does.

> `parts/people.seed.ts` is a **placeholder owned by Dev A**. It exists only
> because identity and timeoff cannot satisfy their foreign keys without
> employees in the table. Dev B: replace it wholesale, but keep the ids from
> `SEED`.

## What the demo needs from the data

The dashboard looks broken on empty data, so the seed is not busywork:

- 5 users, one per role, obvious passwords, printed at the end
- ~25 employees across 3 departments and all employee types
- **One employee with an expired contract *and* a current one** — this is what
  proves period-based contract selection on stage
- 60 days of attendance with deliberate anomalies: 2 missing check-outs,
  3 late, 1 overtime
- Time off types, allocations, and a mix of approved and pending requests
- One **fully paid historical payrun** so the trend chart has data on first load
- One **draft payrun** staged for the live compute demo
