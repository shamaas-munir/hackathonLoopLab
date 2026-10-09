import { CalendarCheck, CalendarClock, MapPin, Printer } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/shared/ThemeToggle";

const FEATURES = [
  { icon: MapPin, text: "Pick the campus where you'll sit your exams." },
  { icon: CalendarClock, text: "Choose a slot for every course, with clashes caught as you go." },
  { icon: Printer, text: "Print or download your final date sheet in one click." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary-hover to-sky p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-foreground/15">
            <CalendarCheck className="size-5" aria-hidden />
          </span>
          ExamSlot
        </div>
        <div className="max-w-md space-y-8">
          <div className="space-y-3">
            <p className="text-sm font-medium tracking-wide uppercase opacity-80">Virtual University</p>
            <h2 className="text-[clamp(2rem,1.4rem+1.6vw,2.75rem)] leading-tight font-semibold tracking-tight">
              Design your own exam date sheet
            </h2>
          </div>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="pt-1.5 text-base opacity-95">{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm opacity-80">Exam scheduling for every campus</p>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-16 items-center justify-between px-4 md:px-6">
          <div className="lg:invisible">
            <Logo href="/login" />
          </div>
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pt-4 pb-[max(3rem,env(safe-area-inset-bottom))] sm:items-center sm:pt-0">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
