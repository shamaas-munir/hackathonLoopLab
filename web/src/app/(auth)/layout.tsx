import { CalendarClock, CircleCheck, MapPin, Printer } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

const FEATURES = [
  { icon: MapPin, text: "Pick your exam campus" },
  { icon: CalendarClock, text: "Clash-free slots" },
  { icon: Printer, text: "Print or download" },
];

const PREVIEW = [
  { code: "CS101", title: "Introduction to Computing", when: "Mon 9:00 AM" },
  {
    code: "MTH101",
    title: "Calculus and Analytical Geometry",
    when: "Wed 2:00 PM",
  },
  { code: "ENG101", title: "English Comprehension", when: "Fri 9:00 AM" },
];

function DatesheetPreview() {
  return (
    <div aria-hidden className="relative max-w-md">
      <div className="absolute inset-0 translate-x-4 translate-y-4 rotate-2 rounded-2xl border bg-primary-soft" />
      <div className="relative rounded-2xl border bg-card p-5 shadow-md">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold">My date sheet</p>
          <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
            <CircleCheck className="size-3.5" />
            Saved
          </span>
        </div>
        <ul className="space-y-2.5">
          {PREVIEW.map((row) => (
            <li
              key={row.code}
              className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2.5"
            >
              <span className="rounded-md bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
                {row.code}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                {row.title}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {row.when}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate flex min-h-dvh flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] [background-size:22px_22px]" />
        <div className="absolute -top-32 -left-24 size-[28rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-24 -bottom-32 size-[26rem] rounded-full bg-sky/20 blur-3xl" />
      </div>

      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 md:px-6">
        <Logo href="/login" />
        <ThemeToggle />
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-start gap-12 px-4 pt-4 pb-[max(3rem,env(safe-area-inset-bottom))] sm:items-center sm:pt-0 md:px-6 lg:grid-cols-2 xl:gap-20">
        <section className="hidden space-y-8 lg:block">
          <div className="space-y-4">
            <p className="inline-flex items-center rounded-full border bg-card/70 px-3 py-1 text-sm font-medium text-primary">
              Virtual University exam portal
            </p>
            <h2 className="text-[clamp(2.25rem,1.5rem+1.8vw,3.25rem)] leading-[1.1] font-semibold tracking-tight">
              Design your own{" "}
              <span className="bg-gradient-to-r from-primary to-sky bg-clip-text text-transparent">
                exam date sheet
              </span>
            </h2>
            <p className="max-w-md text-base text-muted-foreground">
              Choose your campus, pick a slot for every course and get a
              clash-free schedule in minutes.
            </p>
          </div>
          <DatesheetPreview />
          <ul className="flex flex-wrap gap-x-6 gap-y-3 pt-2">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Icon className="size-4 text-primary" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        </section>

        <div className="mx-auto w-full max-w-md lg:mr-0">{children}</div>
      </main>
    </div>
  );
}
