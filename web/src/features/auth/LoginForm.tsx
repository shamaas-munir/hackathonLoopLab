"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { components } from "@/api/schema";
import { FormField } from "@/components/shared/FormField";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { Input } from "@/components/ui/input";
import { ApiError, apiPost, applyFieldErrors } from "@/lib/api";
import { FormAlert } from "./FormAlert";
import { PasswordInput } from "./PasswordInput";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: Values) {
    setError(null);
    try {
      const res = await apiPost<components["schemas"]["LoginResponse"]>("/auth/login/", values);
      router.replace(res.redirect_to);
    } catch (err) {
      if (applyFieldErrors(form.setError, err)) return;
      setError(err instanceof ApiError ? err.message : "Could not sign in. Please try again.");
      form.resetField("password");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <FormAlert message={error} />
      <FormField control={form.control} name="email" label="Email">
        {(field) => (
          <Input
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="you@example.com"
            {...field}
          />
        )}
      </FormField>
      <FormField control={form.control} name="password" label="Password">
        {(field) => <PasswordInput autoComplete="current-password" {...field} />}
      </FormField>
      <div className="-mt-2 flex justify-end">
        <Link
          href="/forgot-password"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline md:min-h-0"
        >
          Forgot password?
        </Link>
      </div>
      <LoadingButton type="submit" size="lg" loading={form.formState.isSubmitting}>
        Sign in
      </LoadingButton>
    </form>
  );
}
