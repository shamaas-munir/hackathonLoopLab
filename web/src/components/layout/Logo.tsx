import { CalendarCheck } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** `rail`: icon only on md (the admin icon rail), full from lg. */
export function Logo({ href, rail = false }: { href: string; rail?: boolean }) {
  return (
    <Link
      href={href}
      className="flex h-11 min-w-11 items-center gap-2 rounded-lg font-semibold tracking-tight"
      aria-label="ExamSlot home"
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <CalendarCheck className="size-5" aria-hidden />
      </span>
      <span className={cn("text-lg", rail && "md:hidden lg:inline")}>ExamSlot</span>
    </Link>
  );
}
