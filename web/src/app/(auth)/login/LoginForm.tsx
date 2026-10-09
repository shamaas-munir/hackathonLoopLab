"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { components } from "@/api/schema";
import { FormField } from "@/components/shared/FormField";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { Input } from "@/components/ui/input";
import { ApiError, apiPost, applyFieldErrors } from "@/lib/api";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});
type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: Values) {
    try {
      const res = await apiPost<components["schemas"]["LoginResponse"]>("/auth/login/", values);
      router.replace(res.redirect_to);
    } catch (err) {
      if (!applyFieldErrors(form.setError, err)) {
        toast.error(err instanceof ApiError ? err.message : "Could not sign in. Please try again.");
      }
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <FormField control={form.control} name="email" label="Email">
        {(field) => <Input type="email" inputMode="email" autoComplete="email" {...field} />}
      </FormField>
      <FormField control={form.control} name="password" label="Password">
        {(field) => <Input type="password" autoComplete="current-password" {...field} />}
      </FormField>
      <div className="-mt-1 text-right text-sm">
        <Link href="/forgot-password" className="text-primary underline-offset-4 hover:underline">
          Forgot password?
        </Link>
      </div>
      <LoadingButton type="submit" size="lg" loading={form.formState.isSubmitting}>
        Sign in
      </LoadingButton>
    </form>
  );
}
