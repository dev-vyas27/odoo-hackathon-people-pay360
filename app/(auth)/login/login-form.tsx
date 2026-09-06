"use client";

/**
 * The login form — and the first demonstration of the project's form rule:
 * react-hook-form driven, validated by a zod schema imported from the identity
 * module, which the login route handler validates with too. One definition,
 * two enforcement points.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
// NOT '@/modules/identity' — that barrel reaches the Postgres repository, and
// pulling the pg driver into a client bundle breaks at module evaluation.
// See modules/identity/schemas.ts.
import { loginSchema, type LoginValues } from "@/modules/identity/schemas";
import { ApiError, apiFetch } from "@/lib/api-client";
import { ResourceForm } from "@/components/resource/resource-form";

export function LoginForm({
  next,
  prefill,
}: {
  next?: string;
  /** Filled in by the demo panel. See login-screen.tsx for how it is applied. */
  prefill?: { email: string; password: string };
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {error ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/25 bg-destructive/8 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}

      <ResourceForm<LoginValues>
        surface={false}
        schema={loginSchema}
        submitLabel="Sign in"
        defaultValues={{
          email: prefill?.email ?? "",
          password: prefill?.password ?? "",
        }}
        fields={[
          {
            name: "email",
            label: "Email",
            type: "email",
            span: 2,
            placeholder: "you@company.com",
          },
          { name: "password", label: "Password", type: "password", span: 2 },
        ]}
        cancel={
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Forgot your password?
          </Link>
        }
        onSubmit={async (values) => {
          setError(null);
          try {
            await apiFetch("/api/auth/login", {
              method: "POST",
              body: JSON.stringify(values),
            });
            /**
             * Refresh BEFORE navigating. The session cookie was just set on the
             * login response, and the router still holds the RSC payload it
             * rendered while anonymous. Refreshing first throws that away, so
             * the push lands on a tree rendered with the new cookie instead of
             * bouncing straight back to /login.
             */
            router.refresh();
            router.push(next ?? "/");
          } catch (reason) {
            setError(
              reason instanceof ApiError
                ? reason.message
                : "Could not sign in. Try again.",
            );
          }
        }}
      />
    </div>
  );
}
