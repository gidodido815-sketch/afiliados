import { NextRequest } from "next/server";
import { json, clientIp, requerir, esRespuesta, SEC_HEADERS } from "@/lib/request";
import { loteDescarga, criteriosDe, type TipoLista } from "@/lib/electores";
import { limitar } from "@/lib/ratelimit";
import { auditar } from "@/lib/audit";
import { aElector, ordenarExtra, etiqueta } from "@/lib/campos";
import { CSV_BOM, fila } from "@/lib/csv";

export const runtime = "nodejs";
export const maxDuration = 60;
const LOTE = 5000;

export async function GET(req: NextRequest) {
  const s = await requerir(req, "descargar");
  if (esRespuesta(s)) return s;
  const sp = req.nextUrl.searchParams;
  const tipo = sp.get("tipo");
  if (tipo !== "afiliados" && tipo !== "no_afiliados") return json({ error: "Tipo de lista inválido." }, 400);
  const c = criteriosDe(sp);
  const max = Math.min(Number(process.env.MAX_FILAS_DESCARGA) || 500_000, 2_000_000);
  const ip = clientIp(req);

  try {
    if (!(await limitar(`dl:${s.u}`, 10, 600))) return json({ error: "Demasiadas descargas. Espere unos minutos." }, 429, { "Retry-After": "600" });
    // Primer lote: valida antes de abrir el stream (si falla, responde JSON con error)
    let cursor: string | null = null;
    let lote = await loteDescarga(tipo as TipoLista, c, cursor, LOTE);
    await auditar(s.u, "descarga", JSON.stringify({ tipo, ...c }), ip);

    let enviadas = 0, encabezado = false, fin = false;
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async pull(ctrl) {
        try {
          if (fin) { ctrl.close(); return; }
          if (!lote.length) { fin = true; ctrl.close(); return; }
          let out = "";
          for (const f of lote) {
            if (enviadas >= max) { fin = true; break; }
            const e = aElector(f); const extra = ordenarExtra(e.extra);
            if (!encabezado) {
              out += CSV_BOM + fila(["N° Orden", "DNI", "Apellido y Nombre", "Domicilio", ...extra.map(x => etiqueta(x.clave)), "Afiliado PJ", "Fecha afiliación PJ"]);
              encabezado = true;
            }
            out += fila([e.orden, e.dni, e.nombre, e.domicilio, ...extra.map(x => x.valor), e.afiliado ? "SI" : "NO", e.fechaAfiliacion ?? ""]);
            enviadas++;
          }
          if (!encabezado) out = CSV_BOM;
          ctrl.enqueue(enc.encode(out));
          if (fin) { ctrl.close(); return; }
          cursor = lote[lote.length - 1]._k;
          lote = lote.length < LOTE ? [] : await loteDescarga(tipo as TipoLista, c, cursor, LOTE);
        } catch (e) {
          console.error("[descarga]", e instanceof Error ? e.message : "error");
          ctrl.error(e);
        }
      },
    });
    const nombre = `${tipo}_pj_${new Date().toISOString().slice(0, 10)}.csv`;
    return new Response(stream, {
      headers: { ...SEC_HEADERS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nombre}"` },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "SIN_AFILIADOS") return json({ error: "Todavía no se cargó el padrón de afiliados." }, 409);
    console.error("[descarga]", e instanceof Error ? e.message : "error");
    return json({ error: "No se pudo generar la descarga." }, 500);
  }
}
