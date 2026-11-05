import { NextRequest } from "next/server";
import { json, requerir, esRespuesta } from "@/lib/request";
import { estadisticas } from "@/lib/electores";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const s = await requerir(req, "estadisticas");
  if (esRespuesta(s)) return s;
  try { return json(await estadisticas()); }
  catch (e) { console.error("[estadisticas]", e instanceof Error ? e.message : "error"); return json({ error: "No se pudo calcular." }, 500); }
}
