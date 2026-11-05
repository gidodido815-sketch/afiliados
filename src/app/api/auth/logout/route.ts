import { NextRequest } from "next/server";
import { COOKIE_NAME } from "@/lib/session";
import { json, origenValido } from "@/lib/request";

export async function POST(req: NextRequest) {
  if (!origenValido(req)) return json({ error: "Origen no permitido." }, 403);
  const res = json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 0 });
  return res;
}
