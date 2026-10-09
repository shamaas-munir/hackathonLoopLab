"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Check, CircleCheck, Circle, KeyRound, LinkIcon } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { components } from "@/api/schema";
import { FormField } from "@/components/shared/FormField";
import { LoadingButton } from "@/components/shared/LoadingButton";
import { Button } from "@/components/ui/button";
import { ApiError, apiPost, applyFieldErrors } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AuthCard, AuthCardSkeleton } from "./AuthCard";
import { PasswordInput } from "./PasswordInput";

type Purpose = components["schemas"]["PurposeEnum"];
type LinkCheck = components["schemas"]["ValidateTokenResponse"];

const RULES = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "At least one letter", test: (v: string) => /[A-Za-z]/.test(v) },
  { label: "At least one number", test: (v: string) => /\d/.test(v) },
];

const schema = z
  .object({
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .regex(/[A-Za-z]/, "Use at least one letter and one number.")
      .regex(/\d/, "Use at least one letter and one number."),
    confirm_password: z.string().min(1, "Confirm your password."),
  })
  .refine((v) => v.password === v.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  });
type Values = z.infer<typeof schema>;

const REDIRECT_SECONDS = 3;

export function SetPasswordFlow() {
  const { uid, token } = useParams<{ uid: string; token: string }>();
  const purpose: Purpose = useSearchParams().get("purpose") === "reset" ? "reset" : "setup";
  const [state, setState] = useState<"form" | "done" | "expired">("form");
  const link = { uid, token, purpose };

  const check = useQuery({
    queryKey: ["auth", "validate-token", uid, token, purpose],
    queryFn: () => apiPost<LinkCheck>("/auth/validate-token/", link),
    staleTime: Infinity,
  });

  if (check.isPending) return <AuthCardSkeleton />;
  if (state === "expired" || check.isError || !check.data.valid) return <ExpiredLink />;
  if (state === "done") return <PasswordSet />;

  return (
    <AuthCard
      icon={KeyRound}
      title={purpose === "setup" ? `Welcome, ${check.data.name}` : "Reset your password"}
      description={
        purpose === "setup"
          ? "Choose a password to activate your ExamSlot account."
          : "Choose a new password for your ExamSlot account."
      }
    >
      <PasswordForm
        email={check.data.email ?? ""}
        onSubmit={async (values) => {
          await apiPost("/auth/set-password/", { ...link, ...values });
          toast.success("Password set. You can now sign in.");
          setState("done");
        }}
        onExpired={() => setState("expired")}
      />
    </AuthCard>
  );
}

function PasswordForm({
  email,
  onSubmit,
  onExpired,
}: {
  email: string;
  onSubmit: (values: Values) => Promise<void>;
  onExpired: () => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirm_password: "" },
  });
  const [password, confirm] = useWatch({ control: form.control, name: ["password", "confirm_password"] });

  async function submit(values: Values) {
    try {
      await onSubmit(values);
    } catch (err) {
      if (err instanceof ApiError && err.code === "LINK_INVALID") return onExpired();
      if (!applyFieldErrors(form.setError, err)) {
        toast.error(err instanceof ApiError ? err.message : "Could not set your password. Please try again.");
      }
    }
  }

  const checks = [
    ...RULES.map((rule) => ({ label: rule.label, ok: rule.test(password) })),
    { label: "Passwords match", ok: confirm.length > 0 && password === confirm },
  ];

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate className="grid gap-4">
      {/* Lets password managers save the new password against the right account. */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      {email && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm break-all text-muted-foreground">
          Account: <span className="font-medium text-foreground">{email}</span>
        </p>
      )}
      <FormField control={form.control} name="password" label="New password">
        {(field) => <PasswordInput autoComplete="new-password" {...field} />}
      </FormField>
      <FormField control={form.control} name="confirm_password" label="Confirm password">
        {(field) => <PasswordInput autoComplete="new-password" {...field} />}
      </FormField>
      <ul className="grid gap-1.5 text-sm sm:grid-cols-2" aria-label="Password requirements">
        {checks.map(({ label, ok }) => (
          <li key={label} className={cn("flex items-center gap-2", ok ? "text-success" : "text-muted-foreground")}>
            {ok ? <Check className="size-4 shrink-0" aria-hidden /> : <Circle className="size-4 shrink-0" aria-hidden />}
            <span>
              {label}
              <span className="sr-only">{ok ? ": done" : ": not yet"}</span>
            </span>
          </li>
        ))}
      </ul>
      <LoadingButton type="submit" size="lg" loading={form.formState.isSubmitting}>
        Set password
      </LoadingButton>
    </form>
  );
}

function PasswordSet() {
  const router = useRouter();
  const [seconds, setSeconds] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (seconds === 0) {
      router.replace("/login");
      return;
    }
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds, router]);

  return (
    <AuthCard
      icon={CircleCheck}
      tone="success"
      title="Password set"
      description={`Your password has been saved. Taking you to sign in in ${seconds} second${seconds === 1 ? "" : "s"}.`}
    >
      <Button asChild size="lg" className="w-full">
        <Link href="/login">Go to login</Link>
      </Button>
    </AuthCard>
  );
}

function ExpiredLink() {
  return (
    <AuthCard
      icon={LinkIcon}
      tone="danger"
      title="This link has expired or has already been used"
      description="Password links work once and expire after a while (24 hours for new accounts, 1 hour for resets). Request a new link and we'll email it to you."
    >
      <div className="grid gap-2">
        <Button asChild size="lg" className="w-full">
          <Link href="/forgot-password">Send a new link</Link>
        </Button>
        <Button asChild variant="link" size="lg" className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
