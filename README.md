<div align="center">

# 💼 PeoplePay360 — HR & Payroll Operations Platform

**An integrated HR and payroll platform built for the Odoo Hackathon.**
Employees, contracts, working schedules, attendance, time off and payroll — one connected operational flow, not five disconnected CRUD screens.

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Tests](https://img.shields.io/badge/tests-300%20passing-22c55e?style=flat-square)](#-testing)

</div>

---

## 📖 The Problem

Most HR tools store employees, attendance, leave and salary as separate records. Real payroll teams need them to work together:

- An employee holds **several contracts over time** — payroll must use the one covering the period being run, not simply the latest.
- Working hours come from an **assigned schedule**, so lateness and proration mean nothing without it.
- Leave balances depend on **allocations minus approved requests**, consumed atomically.
- Payroll must turn all of that into a payslip a human can read, **before** anyone is paid.

PeoplePay360 models those relationships rather than flattening them.

---

## ✨ Features

- 🔐 **JWT auth with a 5-role permission matrix** — one table drives both the API guard and which nav links render, so the UI and the API cannot disagree
- 👥 **Employee hub** — Kanban and List views over one query, with smart buttons that open related records already filtered
- 📄 **Period-based contracts** — overlapping contracts are rejected at write time *and* by a database exclusion constraint
- 🗓️ **Working schedules** — weekly hours are **derived** from the day pattern, never typed in
- ⏱️ **Attendance with exception detection** — present, late, absent, overtime, missing check-out, judged against the employee's own schedule
- 🌴 **Time off** — types, allocations and requests; approving a request consumes the matching balance in one use case
- 🧮 **Salary rule engine** — Strategy + Registry over fixed, percentage and formula rules, executed in sequence so later rules build on earlier results
- 💰 **Two-step payrun wizard** — scope and period, then explicit employee selection; **step one persists nothing**
- ⚠️ **Pre-finalisation warnings** — missing bank details, duplicate payslips and contract issues surface before validation
- 📊 **Payroll dashboard** — live aggregates over employees, attendance, leave and payroll, filtered by period and department

---

## 🏗️ Tech Stack

### Frontend

| Technology | Purpose |
| --- | --- |
| ⚛️ **React 19.2** | UI library |
| ▲ **Next.js 16.3** (App Router) | Full-stack framework, Turbopack |
| 🎨 **Tailwind CSS v4** | CSS-first styling, no config file |
| 🧩 **shadcn/ui + Radix** | Accessible component primitives |
| 🔄 **TanStack Query v5** | Server state, caching, invalidation |
| 📋 **TanStack Table v8** | Sorting and column definitions |
| ✅ **react-hook-form + Zod v4** | Every form, validated by the same schema the API uses |
| 🎯 **react-icons** | Icon library |
| 🔔 **react-hot-toast** | Notifications |

### Backend

| Technology | Purpose |
| --- | --- |
| 🟢 **Node.js** via Next Route Handlers | Server-side logic |
| 🐘 **node-postgres (`pg`)** | Hand-written SQL — no ORM |
| 🔑 **jsonwebtoken** | Stateless sessions, verified in `proxy.ts` |
| 🔒 **bcryptjs** | Password hashing |
| ✅ **Zod v4** | Request validation |

### Infrastructure

| Technology | Purpose |
| --- | --- |
| 🐘 **PostgreSQL 18** | Relational store, hosted on Render |
| 🧪 **Vitest** | 300 unit tests, no database required |
| 📏 **ESLint flat config** | Enforces the module boundaries below |

---

## 🧱 Architecture

The codebase is a **modular monolith** built on Domain-Driven Design. Each bounded context owns its own stack and exposes one public surface:

```
modules/<context>/
  domain/          entities, value objects, pure services   ← zero framework imports
  application/     use cases (1 class = 1 operation), ports
  infrastructure/  SQL repositories, adapters
  interface/       controllers, Zod schemas
  index.ts         the ONLY legal import path from outside
```

Three rules make that real rather than aspirational, and **ESLint enforces all three**:

1. **Module internals are private.** Importing `@/modules/people/domain/...` from anywhere else fails lint.
2. **`domain/` and `application/` are framework-free** — no `next/*`, no `pg`, no React. That is why 300 tests run against in-memory fakes in under a second with no database.
3. **Client code imports `@/modules/<x>/schemas`**, never `@/modules/<x>`. The module barrel reaches the SQL repositories; importing it from a `'use client'` file would pull the Postgres driver into the browser bundle and fail the build.

Modules never import each other's classes. They communicate through **ports** registered in one composition root (`lib/bootstrap.ts`), so payroll asks for a contract without knowing `employment` exists:

```ts
findApplicableContract(employeeId: string, period: Period): Promise<ContractSnapshot | null>
```

See **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)** for the context map, data model, request lifecycle and both end-to-end scenarios as diagrams.

Patterns used deliberately: **Strategy + Registry** (salary rules — a new computation type is one class, the engine never changes), **State** (payrun `draft → computed → validated → paid`), **Specification** (payrun eligibility), **Repository**, and **Value Objects** (`Money` stores integer minor units, because a one-paise float drift across 500 payslips is unfindable).

---

## 🧩 Modules

| Module | Status | Responsibility |
| --- | :---: | --- |
| `shared` | ✅ | Kernel: `Money`, `Period`, `Result`, permissions, ports, event bus |
| `identity` | ✅ | Users, login, password hashing |
| `people` | ✅ | Employee aggregate, departments, job positions |
| `employment` | ✅ | Contracts and working schedules |
| `attendance` | ✅ | Check in/out, worked hours, exception derivation |
| `timeoff` | ✅ | Leave types, allocations, requests, balance consumption |
| `payroll-config` | ✅ | Salary structures and rules, computation strategies |
| `payroll-processing` | ✅ | Payruns, payslips, warnings, state machine |
| `analytics` | ✅ | Dashboard aggregation across every module |
| `delivery` | 🚧 | Payslip PDF and bulk email — **not yet implemented** |

---

## 👥 Role & Permission Matrix

Defined once in `modules/shared/contracts/permissions.ts` and consulted by the API guard, the route proxy and the navigation alike.

| Capability | 👤 Employee | 🧑‍💼 HR Manager | 💵 Payroll User | 💼 Payroll Manager | 🛡️ Admin |
| --- | :---: | :---: | :---: | :---: | :---: |
| View own record, attendance, leave | ✅ | ✅ | ✅ | ✅ | ✅ |
| Record own attendance | ✅ | ✅ | ✅ | ✅ | ✅ |
| Raise own time-off request | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage employees, departments, positions | ❌ | ✅ | ✅ | ✅ | ✅ |
| Manage contracts and schedules | ❌ | ✅ | ✅ | ✅ | ✅ |
| Correct attendance records | ❌ | ✅ | ✅ | ✅ | ✅ |
| Approve / refuse time off | ❌ | ✅ | ✅ | ✅ | ✅ |
| View salary structures and rules | ❌ | ❌ | ✅ (read) | ✅ | ✅ |
| Manage salary structures and rules | ❌ | ❌ | ❌ | ✅ | ✅ |
| Create and compute payruns | ❌ | ❌ | ✅ | ✅ | ✅ |
| Delete / approve payruns | ❌ | ❌ | ❌ | ✅ | ✅ |
| View payroll dashboard | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage users and roles | ❌ | ❌ | ❌ | ❌ | ✅ |

> **Row-level scoping:** the `employee` role holds `employee:read` like everyone else — the difference is *which rows*. Use cases call `authorizeOwned(...)`, so an employee sees only their own records. That check lives in the use case, never in the UI.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js 20.9+**
- **PostgreSQL 13+** (tested on 18) — local or hosted. The database itself must already exist; `npm run migrate` creates tables, not the database.

### 1. Clone and install

```bash
git clone https://github.com/dev-vyas27/odoo-hackathon-people-pay360.git
cd odoo-hackathon-people-pay360
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

| Variable | Required | Notes |
| --- | :---: | --- |
| `DATABASE_URL` | ✅ | `postgresql://user:pass@host:5432/peoplepay360` — append `?sslmode=require` for hosted Postgres |
| `JWT_SECRET` | ✅ | Any long random string: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `DEMO_SEED_ENABLED` | — | Exposes the one-click seed endpoint on the login screen |
| `SMTP_*`, `MAIL_FROM` | — | Reserved for payslip email, which is not implemented yet |

> **Hosted Postgres tip:** if `npm run db:check` reports `querySrv ECONNREFUSED` or a DNS failure, use the provider's **external** connection string rather than the internal one, and make sure the network allowlist includes your IP.

### 3. Create the schema

```bash
npm run migrate      # applies migrations/0001 … 0009 in order
npm run db:check     # confirms connectivity and lists the tables
```

### 4. Seed demo data (optional but recommended)

```bash
npm run seed
```

Creates departments, job positions, working schedules, employees, and one user per role:

| Role | Email | Password |
| --- | --- | --- |
| 🛡️ Admin | `admin@peoplepay360.dev` | `admin1234` |
| 🧑‍💼 HR Manager | `hr@peoplepay360.dev` | `hr1234567` |
| 💵 HR Payroll User | `payroll.user@peoplepay360.dev` | `payroll12` |
| 💼 HR Payroll Manager | `payroll.manager@peoplepay360.dev` | `manager12` |
| 👤 Employee | `employee@peoplepay360.dev` | `employee1` |

The `employee` account is the only one linked to an employee record — sign in as it to see row-level scoping in action.

### 5. Run

```bash
npm run dev
```

`http://localhost:3000` redirects to `/login`. **There is no sign-up page** — this application never lets anyone register themselves. Without seed data, create the first account from the command line:

```bash
npm run create-admin -- --email you@company.com --password "your password" --name "Your Name"
```

---

## 🔧 Available Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint, including the module-boundary rules |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest — 300 tests, no database needed |
| `npm run verify` | typecheck + lint + test, the pre-push gate |
| `npm run migrate` | Apply SQL migrations in order |
| `npm run seed` | Populate demo data |
| `npm run create-admin` | Create the first admin account |
| `npm run db:check` | Diagnose database connectivity |

---

## 🧪 Testing

```bash
npm run test
```

300 tests across 33 files, all running in plain Node with **no database and no Next runtime**. That is a direct consequence of keeping `domain/` and `application/` framework-free: use cases are tested against hand-written in-memory repositories, so the suite finishes in under a second.

The tests concentrate where the business risk is: salary rule sequencing and rounding, contract resolution across overlapping and expired ranges, leave-balance consumption, and worked-hours edge cases such as a shift crossing midnight.

---

## 📁 Project Structure

```
├── app/
│   ├── (auth)/login/            sign-in
│   ├── (dashboard)/             employees, contracts, schedules, attendance,
│   │                            time-off, payroll, reports
│   └── api/                     route handlers — parse, call use case, respond
├── components/
│   ├── ui/                      shadcn primitives
│   ├── resource/                the CRUD kernel: table, form, filters, wizard
│   └── layout/                  nav and user menu
├── hooks/use-resource.ts        typed list/get/create/update/delete
├── lib/
│   ├── db.ts                    pg pool
│   ├── auth.ts                  JWT and the current actor
│   ├── http.ts                  Result → HTTP, the only place both are known
│   └── bootstrap.ts             composition root: every module's ports
├── migrations/                  0001 … 0009, the schema source of truth
├── modules/                     the bounded contexts (see Architecture)
├── scripts/                     migrate, seed, create-admin, db:check
└── proxy.ts                     route guard (Next 16's middleware)
```

---

## 🗺️ Roadmap

- **Payslip PDF and bulk email** — the `delivery` module is scaffolded but not implemented
- **Attendance import** from biometric or CSV sources
- **Multi-currency payroll** — `Money` already carries a currency, the rules engine does not yet reconcile across them
- **Audit trail** on payroll finalisation
- **Deployment** — the app builds cleanly but is not yet hosted

---

## 👨‍💻 Team

Built for the Odoo Hackathon by three developers working in parallel on isolated modules — the boundaries above are what made that possible without merge conflicts.

| Area | Modules |
| --- | --- |
| Platform, identity, time off, analytics | `shared` · `identity` · `timeoff` · `analytics` |
| HR operations | `people` · `employment` · `attendance` |
| Payroll | `payroll-config` · `payroll-processing` |
