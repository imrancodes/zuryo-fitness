import { NextResponse, type NextRequest } from "next/server";
import { ROLE_HOME, ROLES } from "@/lib/roles";
import { SESSION_COOKIE, verifySession } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === "/") {
    return NextResponse.redirect(new URL(session ? ROLE_HOME[session.role] : "/login", request.url));
  }

  const area = ROLES.find((role) => pathname === ROLE_HOME[role] || pathname.startsWith(`${ROLE_HOME[role]}/`));

  if (!area) {
    return NextResponse.next();
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (session.role !== area) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/customer/:path*", "/trainer/:path*", "/admin/:path*"],
};
