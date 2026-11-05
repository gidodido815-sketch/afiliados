import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verificarSesion } from "./lib/session";

// Rutas públicas: solo el login. Todo lo demás exige sesión válida.
const PUBLICAS = ["/login", "/api/auth/login"];

function csp(nonce: string) {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self'${dev ? " 'unsafe-inline'" : ` 'nonce-${nonce}'`}`,
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const esApi = pathname.startsWith("/api/");
  const sesion = await verificarSesion(req.cookies.get(COOKIE_NAME)?.value);

  if (!sesion && !PUBLICAS.includes(pathname)) {
    if (esApi) return NextResponse.json({ error: "Sesión no válida. Inicie sesión." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (sesion && pathname === "/login") return NextResponse.redirect(new URL("/", req.url));

  const nonce = btoa(crypto.randomUUID());
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp(nonce));
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp(nonce));
  if (!esApi) res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico).*)" }],
};
