"use client";



import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { loginSchema, type LoginValues } from "@/modules/identity/schemas";
import { ApiError, apiFetch } from "@/lib/api-client";
import { ResourceForm } from "@/components/resource/resource-form";

export function LoginForm({
  next,
  prefill,
}: {
  next?: string;
  
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
        submitFullWidth
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
            className="self-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
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
