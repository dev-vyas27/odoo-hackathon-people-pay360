import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Module boundaries are enforced here, not by good intentions.
 *
 * Two architectural guarantees:
 *   1. A module's internals are private. Everything it offers is re-exported
 *      from its index.ts.
 *   2. domain/ and application/ are framework-free, so business logic is
 *      testable in milliseconds with no database and no Next runtime.
 *
 * IMPORTANT for anyone editing this file: ESLint flat config OVERRIDES rules
 * per matching block rather than merging them. A later block that sets
 * `no-restricted-imports` REPLACES an earlier one for the same files. That is
 * why the domain/application block below repeats the cross-module patterns
 * instead of relying on the per-module block above it. Splitting them into two
 * blocks silently disables boundary enforcement in exactly the layers that
 * matter most.
 */
const MODULES = [
  "shared",
  "identity",
  "people",
  "employment",
  "attendance",
  "timeoff",
  "payroll-config",
  "payroll-processing",
  "delivery",
  "analytics",
];

const INTERNALS = ["domain", "application", "infrastructure", "interface"];

/** Patterns banning reach-through into every module except `self`. */
const crossModulePatterns = (self) =>
  MODULES.filter((other) => other !== self).map((other) => ({
    group: INTERNALS.map((layer) => `@/modules/${other}/${layer}/**`),
    message: `"${other}" internals are private. Import from '@/modules/${other}' (its index.ts) instead.`,
  }));

/** Bans that keep domain/ and application/ pure. */
const FRAMEWORK_PATHS = [
  {
    name: "mongoose",
    message:
      "Domain/application must not know about the database. Put persistence in infrastructure/.",
  },
  { name: "react", message: "Domain/application must not import React." },
];

const FRAMEWORK_PATTERNS = [
  {
    group: ["next", "next/*"],
    message:
      "Domain/application must stay framework-free. Adapters belong in interface/ or lib/.",
  },
  {
    group: ["@/lib/*"],
    message: "Domain/application must not depend on app-level lib/. Inject a port instead.",
  },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    // Everything outside modules/ (app/, lib/, components/) may only use public surfaces.
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: MODULES.flatMap((m) =>
                INTERNALS.map((layer) => `@/modules/${m}/${layer}/**`),
              ),
              message:
                "Module internals are private. Import from '@/modules/<name>' (its index.ts) instead.",
            },
          ],
        },
      ],
    },
  },

  // Per module: may use its OWN internals, never another module's.
  ...MODULES.map((self) => ({
    files: [`modules/${self}/**/*.ts`],
    rules: {
      "no-restricted-imports": ["error", { patterns: crossModulePatterns(self) }],
    },
  })),

  // Same, PLUS the framework bans. Repeats the cross-module patterns on purpose
  // (see the note at the top of this file).
  ...MODULES.map((self) => ({
    files: [`modules/${self}/domain/**/*.ts`, `modules/${self}/application/**/*.ts`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: FRAMEWORK_PATHS,
          patterns: [...crossModulePatterns(self), ...FRAMEWORK_PATTERNS],
        },
      ],
    },
  })),

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Agent worktrees are full checkouts nested inside the repo; linting them
    // duplicates every finding and reports paths that do not exist on main.
    ".claude/**",
  ]),
]);

export default eslintConfig;
