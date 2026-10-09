import { Suspense } from "react";
import { ThemeToggle } from "@/components/shared/ThemeToggle";
import {
  AdminMobileNav,
  AdminPageTitle,
  AdminSidebarNav,
  AdminSidebarNavFallback,
} from "./AdminNav";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";

// usePathname suspends while prerendering dynamic routes such as /admin/students/[id],
// so every pathname-aware piece sits behind its own small Suspense boundary.
export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh md:flex">
      <aside className="no-print sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-card md:flex md:w-[72px] lg:w-[248px]">
        <div className="flex h-14 items-center border-b px-3 md:justify-center lg:justify-start lg:px-4">
          <Logo href="/admin" rail />
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto p-3">
          <Suspense fallback={<AdminSidebarNavFallback />}>
            <AdminSidebarNav />
          </Suspense>
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-2 backdrop-blur sm:px-4 md:px-6">
          <Suspense fallback={<div className="size-11 md:hidden" />}>
            <AdminMobileNav />
          </Suspense>
          <div className="min-w-0 flex-1">
            <Suspense>
              <AdminPageTitle />
            </Suspense>
          </div>
          <ThemeToggle />
          <UserMenu />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
