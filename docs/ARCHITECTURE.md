# PeoplePay360 — Architecture

Every diagram below is drawn from the code as it stands: module boundaries from
`modules/`, ports from `modules/shared/contracts/port-keys.ts`, tables from
`migrations/0001`–`0009`. If a diagram and the code disagree, the code is right
and this file is stale.

Diagrams are [Mermaid](https://mermaid.js.org/); GitHub renders them inline.

---

## 1. Bounded contexts and their dependencies

The system is a **modular monolith**: one deployable, ten bounded contexts, and
no context may reach into another's internals. Everything crossing a boundary
goes through a *port* — a TypeScript interface published in the shared kernel
and satisfied at runtime by whichever module owns the data.

```mermaid
graph TD
    subgraph Platform
        SHARED["shared<br/><i>Money · Period · Result<br/>permissions · ports · event bus</i>"]
        IDENTITY["identity<br/><i>users · login</i>"]
    end

    subgraph "HR Operations"
        PEOPLE["people<br/><i>employees · departments<br/>job positions</i>"]
        EMPLOYMENT["employment<br/><i>contracts<br/>working schedules</i>"]
        ATTENDANCE["attendance<br/><i>check in/out<br/>exceptions</i>"]
    end

    subgraph "Time Off"
        TIMEOFF["timeoff<br/><i>types · allocations<br/>requests</i>"]
    end

    subgraph Payroll
        PCONFIG["payroll-config<br/><i>salary structures<br/>rules · strategies</i>"]
        PPROC["payroll-processing<br/><i>payruns · payslips<br/>warnings</i>"]
    end

    subgraph Reporting
        ANALYTICS["analytics<br/><i>dashboard aggregation</i>"]
        DELIVERY["delivery<br/><i>PDF · email</i><br/>NOT IMPLEMENTED"]
    end

    PEOPLE -->|employeeLookup| TIMEOFF
    PEOPLE -->|employeeLookup| PPROC
    PEOPLE -->|employeeStats| ANALYTICS
    EMPLOYMENT -->|contractQuery| PPROC
    EMPLOYMENT -->|scheduleQuery| PPROC
    EMPLOYMENT -->|scheduleQuery| ATTENDANCE
    EMPLOYMENT -->|contractAlerts| ANALYTICS
    ATTENDANCE -->|attendanceStats| PPROC
    ATTENDANCE -->|attendanceStats| ANALYTICS
    TIMEOFF -->|leaveStats| ANALYTICS
    PCONFIG -->|structures + rules| PPROC
    PPROC -->|payrollStats| ANALYTICS
    PPROC -->|payslipQuery| DELIVERY

    SHARED -.->|every module depends on the kernel| PEOPLE
    SHARED -.-> EMPLOYMENT
    SHARED -.-> ATTENDANCE
    SHARED -.-> TIMEOFF
    SHARED -.-> PCONFIG
    SHARED -.-> PPROC

    classDef notdone stroke-dasharray: 5 5;
    class DELIVERY notdone;
```

Arrows read *"publishes a port consumed by"*. Payroll never imports
`employment`; it asks the container for `PORT_KEYS.contractQuery` and receives
whatever satisfies that interface. Swapping the implementation is one line in
`lib/bootstrap.ts`.

---

## 2. Anatomy of a module

Every context has the same four layers, and dependencies only ever point
inward. `domain` and `application` import no framework at all — that is what
lets 300 tests run with no database and no Next runtime.

```mermaid
graph LR
    subgraph "modules/<context>"
        direction LR
        INTERFACE["interface/<br/>controllers<br/>Zod schemas"]
        INFRA["infrastructure/<br/>SQL repositories<br/>adapters"]
        APP["application/<br/>use cases<br/>ports"]
        DOMAIN["domain/<br/>entities · value objects<br/>pure services"]
    end

    ROUTE["app/api/**/route.ts"] --> INDEX["index.ts<br/><b>the only public surface</b>"]
    INDEX --> INTERFACE
    INTERFACE --> APP
    INFRA -.->|implements ports| APP
    APP --> DOMAIN
    INFRA --> DB[("PostgreSQL")]
```

Three rules, all enforced by ESLint rather than by convention:

| Rule | Enforced by |
| --- | --- |
| Module internals are private — import `@/modules/<x>`, never `@/modules/<x>/domain/...` | `no-restricted-imports`, per-module patterns |
| `domain/` and `application/` may not import `next/*`, `pg`, `react` or `@/lib/*` | `no-restricted-imports`, paths + patterns |
| Client components import `@/modules/<x>/schemas`, never the module barrel | the barrel reaches the SQL repositories; importing it from `'use client'` pulls the Postgres driver into the browser and fails the build |

---

## 3. Request lifecycle

A route handler is about five lines. It parses, calls one use case, and maps the
`Result` onto HTTP. All the business logic sits below it, where it can be tested
without a server.

```mermaid
sequenceDiagram
    participant B as Browser
    participant P as proxy.ts
    participant R as route.ts
    participant C as Controller
    participant U as Use case
    participant Repo as Repository
    participant DB as PostgreSQL

    B->>P: GET /api/employees
    Note over P: verify JWT, check<br/>section-level permission
    P->>R: authorised request
    R->>C: parse query (Zod)
    C->>U: execute({ actor, query })
    Note over U: authorize(actor, 'employee', 'read')<br/>row-level scoping for the employee role
    U->>Repo: findMany(pageQuery)
    Repo->>DB: SELECT ... LIMIT/OFFSET
    DB-->>Repo: rows
    Repo-->>U: domain objects
    U-->>C: Result<Paged<Employee>>
    C-->>R: Result
    R-->>B: 200 { data } · or 4xx { error }
```

Authorisation happens **twice on purpose**. `proxy.ts` answers "may this role
open this area at all", which is coarse and cheap. The use case answers "may
this actor touch *this row*", which the proxy cannot know because it has not
loaded the record. Hiding a button in the UI is a courtesy, never a control.

---

## 4. Data model

Eighteen application tables, plus a `schema_migrations` bookkeeping table the
migration runner maintains. UUID primary keys throughout, `numeric` for every
money column, `timestamptz` for every instant.

```mermaid
erDiagram
    departments ||--o{ job_positions : "has"
    departments ||--o{ employees : "employs"
    job_positions ||--o{ employees : "holds"
    employees ||--o{ employees : "manages"
    working_schedules ||--o{ working_schedule_days : "pattern"
    working_schedules ||--o{ employees : "assigned to"
    employees ||--o| users : "signs in as"

    employees ||--o{ contracts : "over time"
    working_schedules ||--o{ contracts : "governs"
    salary_structures ||--o{ contracts : "pays by"

    employees ||--o{ attendances : "records"

    timeoff_types ||--o{ timeoff_allocations : "grants"
    employees ||--o{ timeoff_allocations : "holds"
    timeoff_allocations ||--o{ timeoff_requests : "consumed by"
    timeoff_types ||--o{ timeoff_requests : "classifies"
    employees ||--o{ timeoff_requests : "raises"

    salary_structures ||--o{ salary_structure_rules : "contains"
    salary_rules ||--o{ salary_structure_rules : "used in"

    salary_structures ||--o{ payruns : "computed with"
    payruns ||--o{ payrun_employees : "scopes"
    employees ||--o{ payrun_employees : "included in"
    payruns ||--o{ payslips : "produces"
    employees ||--o{ payslips : "paid by"
    contracts ||--o{ payslips : "priced by"
    payslips ||--o{ payslip_lines : "breaks down into"
```

Three constraints carry business rules the application alone could not
guarantee:

| Constraint | Table | Why it exists |
| --- | --- | --- |
| `EXCLUDE USING gist (employee_id WITH =, daterange(starts_on, ends_on, '[]') WITH &&) WHERE status = 'active'` | `contracts` | The spec's "avoid concurrent active contracts". Two racing requests cannot both win; an application-level "does one exist?" check can never promise that. |
| `UNIQUE (employee_id, worked_on)` | `attendances` | One attendance record per person per day. |
| `UNIQUE (payrun_id, employee_id)` | `payslips` | An employee cannot be paid twice in one run. |

The `daterange` is inclusive at both ends (`'[]'`), matching the `Period` value
object exactly — so SQL and the domain agree on what "overlapping" means.

---

## 5. Scenario A — employee to payslip

The first of the two end-to-end walkthroughs. The step that matters is contract
resolution: payroll asks for the contract covering *the period being run*, not
the newest one.

```mermaid
flowchart TD
    A["Create employee<br/><i>people</i>"] --> B["Assign working schedule<br/><i>employment</i>"]
    B --> C["Add contract<br/>wage · dates · structure<br/><i>employment</i>"]
    C --> D["Record attendance<br/><i>attendance</i>"]
    D --> E["Payrun wizard step 1<br/>structure + period<br/><b>persists nothing</b>"]
    E --> F["Step 2 — pick eligible employees<br/><i>employeeLookup.findEligible</i>"]
    F --> G["Create payrun<br/><i>only now is anything written</i>"]
    G --> H["Compute"]

    H --> H1["contractQuery.findApplicableContract<br/>period-correct, not latest"]
    H --> H2["attendanceStats.workedDaysForMany<br/>one query for the whole batch"]
    H --> H3["scheduleQuery.expectedDays<br/>proration denominator"]

    H1 --> I["Rule engine runs in sequence<br/>BASIC → HRA → GROSS → PF → TAX → NET"]
    H2 --> I
    H3 --> I
    I --> J["Payslip + payslip_lines"]
    J --> K{"Warnings?<br/>missing bank details<br/>duplicate payslip<br/>no contract"}
    K -->|resolve| H
    K -->|clear| L["Validate → Mark paid"]
    L --> M["Print PDF · Send payslips<br/><i>delivery — not implemented</i>"]

    classDef notdone stroke-dasharray: 5 5;
    class M notdone;
```

Rules execute in `sequence` order and later rules reference earlier results by
code. Referencing a code that has not run yet is an **error**, not zero —
silently treating it as zero produces a wrong payslip that looks right, which is
the worst failure this system could have.

---

## 6. Scenario B — allocation to request

The second walkthrough. Approval and balance consumption happen in one use case,
so they cannot drift apart.

```mermaid
sequenceDiagram
    actor HR as HR Manager
    actor EMP as Employee
    participant T as timeoff
    participant P as people

    HR->>T: Create leave type<br/>(unit, requires allocation, paid)
    HR->>T: Allocate 18 days to employee
    T->>P: employeeLookup.findById
    P-->>T: employee summary
    Note over T: allocation approved →<br/>balance becomes available

    EMP->>T: Request 3 days
    Note over T: validity window checked<br/>balance checked
    T-->>EMP: status = to_approve

    HR->>T: Approve
    Note over T: ONE use case:<br/>state → approved AND<br/>allocation.taken += 3
    alt insufficient balance
        T-->>HR: refused — balance short
    else sufficient
        T-->>HR: approved, 15 days remaining
        T->>T: publish LeaveRequestApproved
    end
```

---

## 7. Composition root

Ports are declarations; something has to bind them. `instrumentation.ts` runs
once at server start and calls `lib/bootstrap.ts`, the single place that knows
every module exists.

```mermaid
flowchart LR
    I["instrumentation.ts<br/><i>Next runs once at startup</i>"] --> B["lib/bootstrap.ts"]
    B --> T["registerTimeOff()"]
    B --> P["registerPeople()"]
    B --> E["registerEmployment()"]
    B --> A["registerAttendance()"]
    B --> PR["registerPayrollPorts()"]
    B --> INT["registerInterimAdapters()<br/><i>must stay last</i>"]

    T & P & E & A & PR & INT --> C[("container<br/>PORT_KEYS → factory")]
    C --> U["use cases resolve<br/>via getPort / portOr"]
```

`providePort` is **first-wins** and the interim adapters register **last**, so a
real implementation always beats scaffolding. That ordering is what let three
developers integrate continuously: a module that was not finished yet fell
through to a null object instead of breaking everyone else's build.

---

## 8. Design decisions worth defending

| Decision | Reasoning |
| --- | --- |
| **Modular monolith, not microservices** | One deploy, no network between contexts, but the boundaries are real and lint-enforced. A context could be extracted later; none needed to be during a 24-hour build. |
| **Hand-written SQL, no ORM** | The payroll aggregations (`COUNT(*) FILTER`, `GROUP BY` over date ranges, a `daterange` exclusion constraint) are exactly the queries ORMs obscure. |
| **`Money` as integer minor units** | A one-paise float drift across 500 payslips is unfindable. Rounding happens once, explicitly. |
| **Strategy + Registry for salary rules** | A new computation type is one class and one registry line; the engine never changes. Open/closed, applied where the requirements actually vary. |
| **Ports over direct imports** | Payroll and Time Off were built in parallel with the modules they depend on. Each side coded against an interface and integrated in minutes. |
| **Two-layer authorisation** | Coarse checks in the proxy, row-level checks in use cases. Neither layer can answer the other's question. |
| **Permissions as data** | One table drives the API guard, the route proxy and the navigation — the UI cannot offer what the API would refuse. |
