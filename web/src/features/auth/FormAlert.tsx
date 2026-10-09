import { CircleAlert } from "lucide-react";

/** Inline form-level error (wrong credentials, rate limit). Announced to screen readers. */
export function FormAlert({ message }: { message: string | null }) {
  return (
    <div aria-live="assertive">
      {message && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2.5 text-sm text-danger"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">{message}</span>
        </p>
      )}
    </div>
  );
}
