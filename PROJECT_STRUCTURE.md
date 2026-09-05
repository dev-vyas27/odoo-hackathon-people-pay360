# Project Folder Structure

```
odoo-hackathon/
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── .env.example
├── .gitignore
├── components.json
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package.json
├── package-lock.json
├── postcss.config.mjs
├── proxy.ts
├── tsconfig.json
├── vitest.config.mts
│
├── app/
│   ├── api/
│   │   └── health/
│   │       └── route.ts
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── layout/
│   ├── resource/
│   │   ├── page-header.tsx
│   │   ├── resource-form.tsx
│   │   ├── resource-table.tsx
│   │   ├── smart-button.tsx
│   │   └── status-badge.tsx
│   └── ui/
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── checkbox.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── form.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── sheet.tsx
│       ├── skeleton.tsx
│       ├── table.tsx
│       ├── tabs.tsx
│       └── textarea.tsx
│
├── docs/
│   ├── plans/
│   │   ├── DEV-A-platform.md
│   │   ├── DEV-B-hr-operations.md
│   │   └── DEV-C-payroll.md
│   └── specs/
│
├── lib/
│   ├── auth.ts
│   ├── db.ts
│   ├── fonts.ts
│   ├── http.ts
│   └── utils.ts
│
├── modules/
│   ├── analytics/
│   │   ├── application/
│   │   │   └── ports/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   ├── interface/
│   │   └── index.ts
│   │
│   ├── attendance/
│   │   ├── application/
│   │   │   └── ports/
│   │   │       └── attendance-stats.port.ts
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   │   └── attendance-stats.stub.ts
│   │   ├── interface/
│   │   └── index.ts
│   │
│   ├── delivery/
│   │   ├── application/
│   │   │   └── ports/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   ├── interface/
│   │   └── index.ts
│   │
│   ├── employment/
│   │   ├── application/
│   │   │   └── ports/
│   │   │       ├── contract-query.port.ts
│   │   │       └── schedule-query.port.ts
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   │   └── contract-query.stub.ts
│   │   ├── interface/
│   │   └── index.ts
│   │
│   ├── identity/
│   │   ├── application/
│   │   │   └── ports/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   ├── interface/
│   │   └── index.ts
│   │
│   ├── payroll-config/
│   │   ├── application/
│   │   │   └── ports/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   ├── interface/
│   │   └── index.ts
│   │
│   ├── payroll-processing/
│   │   ├── application/
│   │   │   └── ports/
│   │   ├── domain/
│   │   ├── infrastructure/
│   │   ├── interface/
│   │   └── index.ts
│   │
│   ├── people/
│   │   ├── application/
│   │   │   └── ports/
│   │   │       └── employee-lookup.port.ts
│   │   ├── domain/
│   │   │   ├── employee-type.test.ts
│   │   │   └── employee-type.ts
│   │   ├── infrastructure/
│   │   │   └── employee-lookup.stub.ts
│   │   ├── interface/
│   │   └── index.ts
│   │
│   ├── shared/
│   │   ├── application/
│   │   │   ├── ports/
│   │   │   ├── actor.ts
│   │   │   ├── event-bus.ts
│   │   │   └── repository.ts
│   │   ├── contracts/
│   │   │   ├── permissions.ts
│   │   │   └── schema.ts
│   │   ├── domain/
│   │   │   ├── domain-error.ts
│   │   │   ├── domain-event.ts
│   │   │   ├── money.test.ts
│   │   │   ├── money.ts
│   │   │   ├── period.test.ts
│   │   │   ├── period.ts
│   │   │   └── result.ts
│   │   ├── infrastructure/
│   │   │   └── mongo-repository.ts
│   │   ├── interface/
│   │   ├── container.ts
│   │   └── index.ts
│   │
│   └── timeoff/
│       ├── application/
│       │   └── ports/
│       ├── domain/
│       ├── infrastructure/
│       ├── interface/
│       └── index.ts
│
├── public/
│   ├── fonts/
│   │   ├── LTWave-Italic.otf
│   │   ├── LTWave-Light.otf
│   │   ├── LTWave-LightItalic.otf
│   │   ├── LTWave-Medium.otf
│   │   ├── LTWave-MediumItalic.otf
│   │   ├── LTWave-Regular.otf
│   │   ├── LTWave-Thin.otf
│   │   └── LTWave-ThinItalic.otf
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
│
└── scripts/
```

## Notes

- Follows a modular, hexagonal-style architecture under `modules/`: each domain module (`people`, `employment`, `attendance`, `payroll-config`, `payroll-processing`, `identity`, `delivery`, `analytics`, `timeoff`, `shared`) is split into `application/` (use cases + `ports/` interfaces), `domain/` (entities, value objects, business rules), `infrastructure/` (stub/concrete adapters, e.g. Mongo repository), and `interface/` (external-facing layer), each exposed via an `index.ts` barrel.
- `app/` is the Next.js App Router entry point (pages, layout, API routes).
- `components/` holds shared UI (`ui/`, shadcn-style primitives) and resource-oriented composite components (`resource/`).
- `docs/plans/` contains per-developer implementation plans (platform, HR operations, payroll).
- Excludes `node_modules/`, `.git/`, and `.next/` build artifacts.
