import { NextResponse, type NextRequest } from "next/server";

// Optimistic routing by the readable `role` cookie. The backend is the real guard.
const HOME = { admin: "/admin", student: "/student/dashboard" } as const;
type Role = keyof typeof HOME;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const value = request.cookies.get("role")?.value;
  const role: Role | null = value === "admin" || value === "student" ? value : null;

  const redirect = (to: string) => NextResponse.redirect(new URL(to, request.url));

  if (pathname === "/" || pathname === "/login") {
    if (role) return redirect(HOME[role]);
    return pathname === "/" ? redirect("/login") : NextResponse.next();
  }

  const area = pathname.startsWith("/admin") ? "admin" : "student";
  if (role !== area) return redirect(role ? HOME[role] : "/login");
  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/student/:path*"],
};
