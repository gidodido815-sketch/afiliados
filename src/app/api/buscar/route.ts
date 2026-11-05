import { NextRequest } from "next/server";
import { json, clientIp, requerir, esRespuesta } from "@/lib/request";
import { buscar } from "@/lib/electores";
import { limitar } from "@/lib/ratelimit";
import { auditar } from "@/lib/audit";
import { aElector } from "@/lib/campos";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const s = await requerir(req, "buscar");
  if (esRespuesta(s)) return s;
  const ip = clientIp(req);
  try {
    if (!(await limitar(`api:${s.u}`, 60, 60)))
      return json({ error: "Demasiadas solicitudes. Espere un minuto." }, 429, { "Retry-After": "60" });

    const sp = req.nextUrl.searchParams;
    const dni = (sp.get("dni") ?? "").replace(/\D/g, "").slice(0, 12);
    const nombre = (sp.get("nombre") ?? "").slice(0, 100);
    const direccion = (sp.get("direccion") ?? "").slice(0, 100);
    if (!dni && !nombre.trim() && !direccion.trim()) return json({ error: "Ingrese al menos un criterio." }, 400);
    if (dni && dni.length < 3 && !nombre.trim() && !direccion.trim()) return json({ error: "El DNI debe tener al menos 3 dígitos." }, 400);

    const filas = await buscar({ dni, nombre, direccion });
    await auditar(s.u, "buscar", JSON.stringify({ dni, nombre, direccion, n: filas.length }), ip);
    return json({ resultados: filas.map(aElector) });
  } catch (e) {
    console.error("[buscar]", e instanceof Error ? e.message : "error");   // sin criterios ni datos personales en logs
    return json({ error: "Error al procesar la búsqueda." }, 500);          // sin detalle interno al cliente
  }
}
