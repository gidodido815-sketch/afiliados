import { NextRequest } from "next/server";
import { COOKIE_NAME, verificarSesion } from "@/lib/session";
import { json } from "@/lib/request";

export async function GET(req: NextRequest) {
  const s = await verificarSesion(req.cookies.get(COOKIE_NAME)?.value);
  return s ? json({ usuario: s.u, rol: s.r }) : json({ error: "No autenticado" }, 401);
}
