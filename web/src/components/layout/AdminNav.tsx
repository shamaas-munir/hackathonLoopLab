"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardList,
  History,
  Inbox,
  LayoutDashboard,
  Menu,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { apiGet, type Paginated } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/branches", label: "Branches", icon: Building2 },
  { href: "/admin/courses", label: "Courses", icon: BookOpen },
  { href: "/admin/students", label: "Students", icon: Users },
  { href: "/admin/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/admin/schedules", label: "Exam Slots", icon: CalendarClock },
  { href: "/admin/requests", label: "Requests", icon: Inbox },
  { href: "/admin/audit-log", label: "Audit Log", icon: History },
] as const;

/** Invalidate `["requests"]` after approving or rejecting to refresh the sidebar badge. */
export const pendingRequestsKey = ["requests", "pending-count"] as const;

function usePendingRequests() {
  const { data } = useQuery({
    queryKey: pendingRequestsKey,
    queryFn: () => apiGet<Paginated<unknown>>("/admin/requests/?status=pending&page_size=5"),
    retry: false,
  });
  return data?.count ?? 0;
}

const isActive = (pathname: string | null, href: string) =>
  href === "/admin" ? pathname === href : !!pathname?.startsWith(href);

type NavLinksProps = { pathname: string | null; rail?: boolean; onNavigate?: () => void };

function NavLinks({ pathname, rail = false, onNavigate }: NavLinksProps) {
  const pending = usePendingRequests();
  return (
    <ul className="grid gap-1">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        const badge = href === "/admin/requests" && pending > 0 ? pending : null;
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              title={rail ? label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                active && "bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary",
                rail && "md:justify-center md:px-0 lg:justify-start lg:px-3",
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className={cn("truncate", rail && "md:sr-only lg:not-sr-only")}>{label}</span>
              {badge && (
                <span
                  className={cn(
                    "ml-auto min-w-5 rounded-full bg-primary px-1.5 text-center text-xs leading-5 font-semibold text-primary-foreground",
                    rail && "md:absolute md:top-0.5 md:right-1 lg:static",
                  )}
                >
                  {badge}
                  <span className="sr-only"> pending</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AdminSidebarNav() {
  return <NavLinks pathname={usePathname()} rail />;
}

/** Shown while the pathname is unknown (prerendering dynamic routes). */
export function AdminSidebarNavFallback() {
  return <NavLinks pathname={null} rail />;
}

export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-0 p-0">
        <SheetHeader className="h-14 justify-center border-b px-4 py-0">
          <SheetTitle asChild>
            <div>
              <Logo href="/admin" />
            </div>
          </SheetTitle>
        </SheetHeader>
        <nav aria-label="Main" className="overflow-y-auto p-3">
          <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}

export function AdminPageTitle() {
  const pathname = usePathname();
  const item = NAV.find(({ href }) => isActive(pathname, href));
  return <p className="truncate font-semibold">{item?.label}</p>;
}
