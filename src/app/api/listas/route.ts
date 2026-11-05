import { NextRequest } from "next/server";
import { json, clientIp, requerir, esRespuesta } from "@/lib/request";
import { lista, criteriosDe, type TipoLista } from "@/lib/electores";
import { limitar } from "@/lib/ratelimit";
import { auditar } from "@/lib/audit";
import { aElector, ordenarExtra } from "@/lib/campos";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const s = await requerir(req, "listas");
  if (esRespuesta(s)) return s;
  try {
    if (!(await limitar(`api:${s.u}`, 60, 60))) return json({ error: "Demasiadas solicitudes. Espere un minuto." }, 429, { "Retry-After": "60" });
    const sp = req.nextUrl.searchParams;
    const tipo = sp.get("tipo");
    if (tipo !== "afiliados" && tipo !== "no_afiliados") return json({ error: "Tipo de lista inválido." }, 400);
    const pagina = Math.min(Math.max(parseInt(sp.get("pagina") ?? "1", 10) || 1, 1), 100_000);
    const tam = Math.min(Math.max(parseInt(sp.get("tam") ?? "50", 10) || 50, 10), 200);
    const c = criteriosDe(sp);
    const { total, filas } = await lista(tipo as TipoLista, c, pagina, tam);
    await auditar(s.u, "lista", JSON.stringify({ tipo, pagina, ...c }), clientIp(req));
    return json({ total, pagina, tam, filas: filas.map(f => { const e = aElector(f); return { ...e, extra: ordenarExtra(e.extra) }; }) });
  } catch (e) {
    if (e instanceof Error && e.message === "SIN_AFILIADOS")
      return json({ error: "Todavía no se cargó el padrón de afiliados (ver README: cargar_afiliados.py)." }, 409);
    console.error("[listas]", e instanceof Error ? e.message : "error");
    return json({ error: "Error al obtener la lista." }, 500);
  }
}
