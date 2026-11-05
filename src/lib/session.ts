// Sesión firmada (HMAC-SHA256). Usa solo Web Crypto → funciona en middleware (Edge) y en Node.

export type Rol = "admin" | "operador" | "consulta";
export type Permiso = "buscar" | "listas" | "descargar" | "estadisticas";

export interface Sesion { u: string; r: Rol; iat: number; exp: number }

const PERMISOS: Record<Rol, Permiso[]> = {
  consulta: ["buscar"],
  operador: ["buscar", "listas", "descargar"],
  admin:    ["buscar", "listas", "descargar", "estadisticas"],
};
export const tienePermiso = (rol: Rol, p: Permiso) => PERMISOS[rol]?.includes(p) ?? false;

const enProduccion = process.env.NODE_ENV === "production";
// "__Host-" obliga Secure + Path=/ + sin Domain (evita que otro subdominio pise la cookie)
export const COOKIE_NAME = enProduccion ? "__Host-padron_sid" : "padron_sid";
export const sesionHoras = () => {
  const h = Number(process.env.SESSION_HORAS ?? 8);
  return Number.isFinite(h) && h > 0 && h <= 72 ? h : 8;
};

const enc = new TextEncoder();
const b64u = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = ""; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64u = (s: string) => {
  const p = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(p); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export function secretoValido(): string | null {
  const s = process.env.SESSION_SECRET ?? "";
  return s.length >= 32 ? s : null;
}

async function clave(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function firmarSesion(s: Sesion): Promise<string> {
  const secret = secretoValido();
  if (!secret) throw new Error("SESSION_SECRET ausente o menor a 32 caracteres");
  const payload = b64u(enc.encode(JSON.stringify(s)));
  const sig = await crypto.subtle.sign("HMAC", await clave(secret), enc.encode(payload));
  return `${payload}.${b64u(sig)}`;
}

export async function verificarSesion(token: string | undefined | null): Promise<Sesion | null> {
  const secret = secretoValido();
  if (!secret || !token || token.length > 1024) return null;
  const [payload, sig, extra] = token.split(".");
  if (!payload || !sig || extra !== undefined) return null;
  try {
    // crypto.subtle.verify compara en tiempo constante
    const ok = await crypto.subtle.verify("HMAC", await clave(secret), fromB64u(sig), enc.encode(payload));
    if (!ok) return null;
    const s = JSON.parse(new TextDecoder().decode(fromB64u(payload))) as Sesion;
    if (typeof s.u !== "string" || !(s.r in PERMISOS)) return null;
    if (typeof s.exp !== "number" || s.exp * 1000 < Date.now()) return null;
    return s;
  } catch { return null; }
}
