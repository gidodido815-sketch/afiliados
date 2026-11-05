import { NextRequest } from "next/server";
import { autenticar, hayUsuarios } from "@/lib/auth";
import { COOKIE_NAME, firmarSesion, secretoValido, sesionHoras } from "@/lib/session";
import { json, clientIp, origenValido } from "@/lib/request";
import { contar, registrar, reiniciar } from "@/lib/ratelimit";
import { auditar } from "@/lib/audit";

export const runtime = "nodejs";
const VENTANA = 900;            // 15 min
const MAX_POR_IP = 20, MAX_POR_USUARIO = 5;

export async function POST(req: NextRequest) {
  if (!origenValido(req)) return json({ error: "Origen no permitido." }, 403);
  if (!secretoValido() || !hayUsuarios()) return json({ error: "Autenticación no configurada en el servidor." }, 503);

  let body: { usuario?: unknown; clave?: unknown };
  try { body = await req.json(); } catch { return json({ error: "Solicitud inválida." }, 400); }
  const usuario = typeof body.usuario === "string" ? body.usuario.trim().toLowerCase().slice(0, 64) : "";
  const clave = typeof body.clave === "string" ? body.clave.slice(0, 256) : "";
  if (!usuario || !clave) return json({ error: "Ingrese usuario y clave." }, 400);

  const ip = clientIp(req);
  const kIp = `login:ip:${ip}`, kUser = `login:u:${usuario}`;
  try {
    if ((await contar(kIp, VENTANA)) >= MAX_POR_IP || (await contar(kUser, VENTANA)) >= MAX_POR_USUARIO) {
      await auditar(usuario, "login_bloqueado", "demasiados intentos", ip);
      return json({ error: "Demasiados intentos. Espere 15 minutos." }, 429, { "Retry-After": String(VENTANA) });
    }
    const u = await autenticar(usuario, clave);
    if (!u) {
      await Promise.all([registrar(kIp, VENTANA), registrar(kUser, VENTANA)]);
      await auditar(usuario, "login_fallido", "", ip);
      return json({ error: "Usuario o clave incorrectos." }, 401);   // mismo mensaje exista o no el usuario
    }
    await reiniciar(kUser);
    const iat = Math.floor(Date.now() / 1000), horas = sesionHoras();
    const token = await firmarSesion({ u: u.nombre, r: u.rol, iat, exp: iat + horas * 3600 });
    await auditar(u.nombre, "login_ok", u.rol, ip);
    const res = json({ ok: true, usuario: u.nombre, rol: u.rol });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: horas * 3600,
    });
    return res;
  } catch (e) {
    console.error("[login]", e instanceof Error ? e.message : "error");
    return json({ error: "Servicio no disponible." }, 503);
  }
}
