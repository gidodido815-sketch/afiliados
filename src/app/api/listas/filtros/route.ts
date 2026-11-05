import { NextRequest } from "next/server";
import { json, requerir, esRespuesta } from "@/lib/request";
import { opcionesFiltro, getEsquema } from "@/lib/electores";

export const runtime = "nodejs";
const cache = new Map<string, { t: number; v: unknown }>();

export async function GET(req: NextRequest) {
  const s = await requerir(req, "listas");
  if (esRespuesta(s)) return s;
  try {
    const sp = req.nextUrl.searchParams;
    const c = { departamento: (sp.get("departamento") ?? "").slice(0, 100), seccion: (sp.get("seccion") ?? "").slice(0, 100) };
    const key = JSON.stringify(c), hit = cache.get(key);
    if (hit && Date.now() - hit.t < 600_000) return json(hit.v);
    const es = await getEsquema();
    const [departamentos, secciones, circuitos] = await Promise.all([
      opcionesFiltro("departamento", c), opcionesFiltro("seccion", c), opcionesFiltro("circuito", c),
    ]);
    const v = { departamentos, secciones, circuitos, tieneMesa: !!es.mesa };
    if (cache.size > 200) cache.clear();
    cache.set(key, { t: Date.now(), v });
    return json(v);
  } catch (e) {
    console.error("[filtros]", e instanceof Error ? e.message : "error");
    return json({ error: "No se pudieron cargar los filtros." }, 500);
  }
}
