import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";

// cesty, ktere nevyzaduji prihlaseni
const PUBLIC_ROUTES = ["/login", "/api", "/health"];

// prida bezpecnostni hlavicky do odpovedi
function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  return response;
}

// zpracuje autentizaci uzivatele a vrati spravnou odpoved ci presmerovani
function handleAuthentication(request: NextRequest): NextResponse {
  const sessionCookie = request.cookies.get("session_id");
  const pathname = request.nextUrl.pathname;

  const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

  // pokud uzivatel neni prihlasen a pristupuje na chranenou cestu, presmeruj na login
  if (!isPublicRoute && !sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // pokud je uzivatel prihlasen a je na strance loginu
  if (sessionCookie && pathname === "/login") {
    // pokud je zobrazen chybovy stav neopravneneho pristupu, smaz mu starou cookie
    if (request.nextUrl.searchParams.get("error") === "unauthorized") {
      const response = NextResponse.next();
      response.cookies.delete("session_id");
      return response;
    }
    // jinak jej presmeruj rovnou do aplikace
    return NextResponse.redirect(new URL("/app", request.url));
  }

  // v ostatnich pripadech pozadavek propust
  return NextResponse.next();
}

// hlavni proxy funkce pro zpracovani pozadavku
export function proxy(request: NextRequest): NextResponse {
  const response = handleAuthentication(request);
  return withSecurityHeaders(response);
}

// konfigurace pro matcher
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
