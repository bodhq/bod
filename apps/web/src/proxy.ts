import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/login", "/api", "/health"];

export function proxy(request: NextRequest) {
  const sessionCookie = request.cookies.get("session_id");
  const pathname = request.nextUrl.pathname;

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  let response = NextResponse.next();

  if (!isPublicRoute && !sessionCookie) {
    response = NextResponse.redirect(new URL("/login", request.url));
  } else if (sessionCookie && pathname === "/login") {
    if (request.nextUrl.searchParams.get("error") === "unauthorized") {
      // The session cookie is invalid, delete it so the user can login again
      response.cookies.delete("session_id");
    } else {
      // Valid session cookie and on login page, redirect to app
      response = NextResponse.redirect(new URL("/app", request.url));
    }
  }

  // Security Headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
  response.headers.set("X-XSS-Protection", "1; mode=block");

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
