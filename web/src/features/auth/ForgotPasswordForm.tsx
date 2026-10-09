"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { components } from "@/api/schema";
import { FormField } from "@/components/shared/FormField";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError, apiPost } from "@/lib/api";
import { AuthCard } from "./AuthCard";
import { FormAlert } from "./FormAlert";

const schema = z.object({ email: z.string().trim().email("Enter a valid email address.") });
type Values = z.infer<typeof schema>;

function BackToLogin({ variant }: { variant: "outline" | "link" }) {
  return (
    <Button asChild variant={variant} size="lg" className="w-full">
      <Link href="/login">
        <ArrowLeft aria-hidden />
        Back to sign in
      </Link>
    </Button>
  );
}

export function ForgotPasswordForm() {
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  async function onSubmit(values: Values) {
    setError(null);
    try {
      const res = await apiPost<components["schemas"]["Message"]>("/auth/forgot-password/", values);
      setSentMessage(res.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the link. Please try again.");
    }
  }

  if (sentMessage) {
    return (
      <AuthCard
        icon={MailCheck}
        tone="success"
        title="Check your email"
        description={
          <>
            {sentMessage} The link expires in 1 hour and works once. Check your spam folder if you
            don&apos;t see it.
          </>
        }
      >
        <BackToLogin variant="outline" />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter the email you use for ExamSlot and we'll send you a link to set a new password."
    >
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
        <FormAlert message={error} />
        <FormField control={form.control} name="email" label="Email">
          {(field) => (
            <Input
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="you@example.com"
              {...field}
            />
          )}
        </FormField>
        <LoadingButton type="submit" size="lg" loading={form.formState.isSubmitting}>
          Send reset link
        </LoadingButton>
        <BackToLogin variant="link" />
      </form>
    </AuthCard>
  );
}
