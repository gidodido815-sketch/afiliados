// Consultas sobre el padrón general (tabla electores) cruzadas con afiliados al PJ.
import { query, ident, escapeLike } from "./db";
import { ALIAS, buscarColumna, type Fila } from "./campos";

const EXCLUIDOS = new Set(["archivo_origen","archivo","fuente","path","ruta","file","filename","id_interno","created_at","updated_at","id"]);

export interface Esquema {
  cols: string[];            // columnas públicas (sin id ni metadatos)
  dni: string | null; nombre: string | null; domicilio: string | null; anio: string | null;
  departamento: string | null; seccion: string | null; circuito: string | null; mesa: string | null;
  unaccent: boolean; hayAfiliados: boolean;
}

let cache: { t: number; v: Esquema } | null = null;

export async function getEsquema(): Promise<Esquema> {
  if (cache && Date.now() - cache.t < 300_000) return cache.v;
  const rows = await query<{ table_name: string; column_name: string }>(
    `SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name IN ('electores','afiliados') ORDER BY table_name, ordinal_position`);
  const all = rows.filter(r => r.table_name === "electores").map(r => r.column_name);
  const cols = all.filter(c => !EXCLUIDOS.has(c.toLowerCase()) && /^[\p{L}_][\p{L}\p{N}_ ]{0,62}$/u.test(c));
  let unaccent = false;
  try { await query("SELECT unaccent('x')"); unaccent = true; } catch { /* extensión no instalada */ }
  const v: Esquema = {
    cols,
    dni: buscarColumna(cols, ALIAS.dni), nombre: buscarColumna(cols, ALIAS.nombre),
    domicilio: buscarColumna(cols, ALIAS.domicilio), anio: buscarColumna(cols, ALIAS.anio),
    departamento: buscarColumna(cols, ALIAS.departamento), seccion: buscarColumna(cols, ALIAS.seccion),
    circuito: buscarColumna(cols, ALIAS.circuito), mesa: buscarColumna(cols, ALIAS.mesa),
    unaccent, hayAfiliados: rows.some(r => r.table_name === "afiliados"),
  };
  cache = { t: Date.now(), v };
  return v;
}

const digitos = (col: string) => `regexp_replace(CAST(e.${ident(col)} AS TEXT), '\\D', '', 'g')`;

/** Condición de cruce: mismo DNI y, si ambos lados tienen año de nacimiento, el mismo año
 *  (hay DNI repetidos entre personas distintas en el padrón de afiliados). */
function cruce(es: Esquema): string {
  const d = digitos(es.dni!);
  let c = `a.matricula = ${d}`;
  if (es.anio) {
    const y = digitos(es.anio);
    c += ` AND (a.clase IS NULL OR length(${y}) <> 4 OR a.clase::text = ${y})`;
  }
  return c;
}

const norm = (s: string) => s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Condiciones de texto (palabras) sobre una columna. Devuelve SQL con placeholders desde `idx`. */
function palabras(col: string, texto: string, es: Esquema, params: unknown[]): string[] {
  const ws = norm(texto).replace(/[^A-Z0-9Ñ°º.\s-]/g, " ").split(/\s+/).filter(w => w.length >= 1).slice(0, 6);
  return ws.map(w => {
    params.push(`%${escapeLike(w)}%`);
    const c = `e.${ident(col)}`;
    return (es.unaccent ? `UPPER(unaccent(${c}))` : `UPPER(${c})`) + ` LIKE $${params.length} ESCAPE '\\'`;
  });
}

export interface Criterios {
  dni?: string; nombre?: string; direccion?: string; q?: string;
  departamento?: string; seccion?: string; circuito?: string; mesa?: string;
}

export function criteriosDe(sp: URLSearchParams): Criterios {
  const g = (k: string) => (sp.get(k) ?? "").slice(0, 100);
  return { q: g("q"), departamento: g("departamento"), seccion: g("seccion"), circuito: g("circuito"), mesa: g("mesa") };
}

function condiciones(es: Esquema, c: Criterios, params: unknown[]): string[] {
  const w: string[] = [];
  const dni = (c.dni ?? "").replace(/\D/g, "").slice(0, 12);
  if (dni && es.dni) {
    params.push(dni.length >= 7 ? dni : escapeLike(dni) + "%");
    w.push(dni.length >= 7 ? `${digitos(es.dni)} = $${params.length}` : `${digitos(es.dni)} LIKE $${params.length}`);
  }
  if (c.nombre && es.nombre) w.push(...palabras(es.nombre, c.nombre, es, params));
  if (c.direccion && es.domicilio) w.push(...palabras(es.domicilio, c.direccion, es, params));
  if (c.q) {
    const t = c.q.trim();
    if (/^\d+$/.test(t) && es.dni) { params.push(escapeLike(t.slice(0, 12)) + "%"); w.push(`${digitos(es.dni)} LIKE $${params.length}`); }
    else if (es.nombre) w.push(...palabras(es.nombre, t, es, params));
  }
  for (const k of ["departamento", "seccion", "circuito", "mesa"] as const) {
    const v = c[k]?.slice(0, 100), col = es[k];
    if (v && col) { params.push(v); w.push(`CAST(e.${ident(col)} AS TEXT) = $${params.length}`); }
  }
  return w;
}

const selectCols = (es: Esquema) => es.cols.map(c => `e.${ident(c)}`).join(", ");
const FECHA = `to_char(af.fecha_afiliacion, 'DD/MM/YYYY')`;

/** Búsqueda (hasta 150) con indicador de afiliación. */
export async function buscar(c: Criterios): Promise<Fila[]> {
  const es = await getEsquema();
  const params: unknown[] = [];
  const w = condiciones(es, c, params);
  if (!w.length) return [];
  const afil = es.hayAfiliados && es.dni
    ? `LEFT JOIN LATERAL (SELECT 1 AS ok, a.fecha_afiliacion FROM afiliados a WHERE ${cruce(es)} LIMIT 1) af ON true`
    : "";
  const flags = afil ? `, (af.ok IS NOT NULL) AS "_afiliado", ${FECHA} AS "_fecha_afil"` : "";
  return query<Fila>(`SELECT ${selectCols(es)}${flags} FROM electores e ${afil} WHERE ${w.join(" AND ")} LIMIT 150`, params);
}

export type TipoLista = "afiliados" | "no_afiliados";

function armarLista(es: Esquema, tipo: TipoLista, c: Criterios, params: unknown[]) {
  const w = condiciones(es, c, params);
  const join = tipo === "afiliados"
    ? `JOIN LATERAL (SELECT a.fecha_afiliacion FROM afiliados a WHERE ${cruce(es)} ORDER BY a.id LIMIT 1) af ON true`
    : `LEFT JOIN LATERAL (SELECT NULL::date AS fecha_afiliacion) af ON true`;
  if (tipo === "no_afiliados") w.push(`NOT EXISTS (SELECT 1 FROM afiliados a WHERE ${cruce(es)})`);
  const flags = `, ${tipo === "afiliados" ? "true" : "false"} AS "_afiliado", ${FECHA} AS "_fecha_afil"`;
  return { join, where: w.length ? "WHERE " + w.join(" AND ") : "", flags };
}

export async function lista(tipo: TipoLista, c: Criterios, pagina: number, tam: number) {
  const es = await getEsquema();
  if (!es.dni || !es.hayAfiliados) throw new Error("SIN_AFILIADOS");
  const p1: unknown[] = [], l1 = armarLista(es, tipo, c, p1);
  const total = await query<{ n: string }>(`SELECT count(*) AS n FROM electores e ${l1.join} ${l1.where}`, p1);
  const p2: unknown[] = [], l2 = armarLista(es, tipo, c, p2);
  p2.push(tam, (pagina - 1) * tam);
  const filas = await query<Fila>(
    `SELECT ${selectCols(es)}${l2.flags} FROM electores e ${l2.join} ${l2.where}
     ORDER BY e.ctid LIMIT $${p2.length - 1} OFFSET $${p2.length}`, p2);
  return { total: Number(total[0]?.n ?? 0), filas };
}

/** Lote para descarga (paginación por cursor sobre ctid: eficiente aunque haya cientos de miles de filas). */
export async function loteDescarga(tipo: TipoLista, c: Criterios, cursor: string | null, tam: number) {
  const es = await getEsquema();
  if (!es.dni || !es.hayAfiliados) throw new Error("SIN_AFILIADOS");
  const params: unknown[] = [], l = armarLista(es, tipo, c, params);
  let where = l.where;
  if (cursor) { params.push(cursor); where += (where ? " AND " : "WHERE ") + `e.ctid > $${params.length}::tid`; }
  params.push(tam);
  return query<Fila & { _k: string }>(
    `SELECT ${selectCols(es)}${l.flags}, e.ctid::text AS "_k" FROM electores e ${l.join} ${where}
     ORDER BY e.ctid LIMIT $${params.length}`, params);
}

export async function opcionesFiltro(campo: "departamento" | "seccion" | "circuito", c: Criterios): Promise<string[]> {
  const es = await getEsquema();
  const col = es[campo]; if (!col) return [];
  const params: unknown[] = [];
  const w = [`e.${ident(col)} IS NOT NULL`, `e.${ident(col)} <> ''`];
  for (const k of ["departamento", "seccion"] as const) {
    if (k !== campo && c[k] && es[k]) { params.push(c[k]); w.push(`CAST(e.${ident(es[k]!)} AS TEXT) = $${params.length}`); }
  }
  const r = await query<{ v: string }>(
    `SELECT DISTINCT CAST(e.${ident(col)} AS TEXT) AS v FROM electores e WHERE ${w.join(" AND ")} ORDER BY 1 LIMIT 1000`, params);
  return r.map(x => x.v);
}

export async function estadisticas() {
  const es = await getEsquema();
  const [e, a, c] = await Promise.all([
    query<{ n: string }>("SELECT count(*) AS n FROM electores"),
    es.hayAfiliados ? query<{ n: string }>("SELECT count(*) AS n FROM afiliados") : Promise.resolve([{ n: "0" }]),
    es.hayAfiliados ? query<{ fecha: string; archivo: string; filas: number }>(
      "SELECT to_char(fecha AT TIME ZONE 'America/Argentina/Buenos_Aires','DD/MM/YYYY HH24:MI') AS fecha, archivo, filas FROM cargas_afiliados ORDER BY id DESC LIMIT 1")
      : Promise.resolve([]),
  ]);
  let coinciden = 0, sinPadron = 0;
  if (es.dni && es.hayAfiliados) {
    const x = await query<{ n: string }>(`SELECT count(*) AS n FROM electores e WHERE EXISTS (SELECT 1 FROM afiliados a WHERE ${cruce(es)})`);
    coinciden = Number(x[0].n);
    const y = await query<{ n: string }>(
      `SELECT count(*) AS n FROM afiliados a WHERE NOT EXISTS (SELECT 1 FROM electores e WHERE ${cruce(es)})`);
    sinPadron = Number(y[0].n);
  }
  return {
    electores: Number(e[0].n), afiliados: Number(a[0].n), electoresAfiliados: coinciden,
    electoresNoAfiliados: Number(e[0].n) - coinciden, afiliadosSinPadron: sinPadron,
    ultimaCarga: c[0] ?? null, hayAfiliados: es.hayAfiliados,
  };
}
