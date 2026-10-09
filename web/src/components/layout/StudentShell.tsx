import { ThemeToggle } from "@/components/shared/ThemeToggle";
import { Logo } from "./Logo";
import { StudentDesktopNav, StudentMobileNav } from "./StudentNav";
import { UnlockBanner } from "./UnlockBanner";
import { UserMenu } from "./UserMenu";

export function StudentShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-2 sm:px-4 md:px-6">
          <StudentMobileNav />
          <Logo href="/student/dashboard" />
          <StudentDesktopNav />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6 lg:p-8">
        <UnlockBanner />
        {children}
      </main>
    </div>
  );
}
