import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verificarSesion, tienePermiso, type Permiso, type Sesion } from "./session";

export const SEC_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Pragma": "no-cache",
};

export function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(data, { status, headers: { ...SEC_HEADERS, ...extra } });
}

/** IP del cliente. Prioriza cabeceras que pone la plataforma (no falsificables por el cliente). */
export function clientIp(req: NextRequest): string {
  const h = req.headers;
  const v = h.get("x-vercel-forwarded-for") ?? h.get("cf-connecting-ip") ?? h.get("x-real-ip");
  if (v) return v.split(",")[0].trim().slice(0, 64);
  // X-Forwarded-For: el último valor lo agrega el proxy más cercano; el primero lo controla el cliente
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",").pop()!.trim().slice(0, 64);
  return "desconocida";
}

/** Verifica sesión y permiso. Devuelve la sesión o una respuesta de error lista para retornar. */
export async function requerir(req: NextRequest, permiso: Permiso): Promise<Sesion | NextResponse> {
  const s = await verificarSesion(req.cookies.get(COOKIE_NAME)?.value);
  if (!s) return json({ error: "Sesión no válida. Inicie sesión." }, 401);
  if (!tienePermiso(s.r, permiso)) return json({ error: "No tiene permiso para esta acción." }, 403);
  return s;
}
export const esRespuesta = (x: Sesion | NextResponse): x is NextResponse => x instanceof NextResponse;

/** Defensa CSRF adicional para métodos que cambian estado: el Origin debe ser el propio sitio. */
export function origenValido(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === req.headers.get("host"); } catch { return false; }
}
