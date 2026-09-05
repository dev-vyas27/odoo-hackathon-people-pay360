import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Module boundaries are enforced here, not by good intentions.
 *
 * The architecture rule is: a module's internals are private. Everything a
 * module offers the rest of the app is re-exported from its index.ts. These
 * lint rules make a violation a red squiggle in the editor rather than
 * something discovered during the merge at 4am.
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

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    // Rule 1: nobody may reach into another module's internals.
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/modules/*/domain/**",
                "@/modules/*/application/**",
                "@/modules/*/infrastructure/**",
                "@/modules/*/interface/**",
              ],
              message:
                "Module internals are private. Import from '@/modules/<name>' (its index.ts) instead.",
            },
          ],
        },
      ],
    },
  },

  {
    // Rule 2: a module MAY import its own internals with relative paths.
    files: MODULES.map((m) => `modules/${m}/**/*.ts`),
    rules: { "no-restricted-imports": "off" },
  },

  {
    /**
     * Rule 3: the domain layer is framework-free.
     *
     * If domain/ or application/ imports next/*, mongoose or react, the
     * business logic has become un-testable and un-portable. This is the single
     * most valuable rule in the file.
     */
    files: ["modules/*/domain/**/*.ts", "modules/*/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "mongoose", message: "Domain/application must not know about the database. Put persistence in infrastructure/." },
            { name: "react", message: "Domain/application must not import React." },
          ],
          patterns: [
            { group: ["next", "next/*"], message: "Domain/application must stay framework-free. Adapters belong in interface/ or lib/." },
            { group: ["@/lib/*"], message: "Domain/application must not depend on app-level lib/. Inject a port instead." },
          ],
        },
      ],
    },
  },

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
