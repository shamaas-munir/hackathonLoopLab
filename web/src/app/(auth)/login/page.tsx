import type { Metadata } from "next";
import { AuthCard } from "@/features/auth/AuthCard";
import { LoginForm } from "@/features/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="space-y-4">
      <AuthCard title="Sign in" description="Use the email address registered with the university.">
        <LoginForm />
      </AuthCard>
      <p className="px-2 text-center text-sm text-muted-foreground">
        Accounts are created by the university administration. New students get a setup link by email.
      </p>
    </div>
  );
}
