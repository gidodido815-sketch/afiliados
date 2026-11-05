// Utilidades compartidas (servidor y navegador) para interpretar las columnas del padrón.
export type Fila = Record<string, string | number | boolean | null | undefined>;

export const ALIAS = {
  dni: ["matricula","dni","documento","nro_documento","numero_documento","nro_doc","doc","cedula","ndoc","n_doc"],
  nombre: ["apellido_nombre","apellido_y_nombre","nombre_completo","apellido","nombre","ap_nombre","nom_apellido","apenom","ape_nom",
           "apellidonombre","nombresyapellidos","nombres","ap_y_nom","apynom","apellidos_nombres","apellido_nombres","nom","apenom_ord"],
  domicilio: ["domicilio","domicilio_electoral","direccion","calle","dom","dir","domicilio_real","direcc","domicilio_padron"],
  orden: ["orden","n_orden","norden","numero_orden","nro_orden"],
  anio: ["clase","anio_nacimiento","año_nacimiento","ano_nacimiento","anio","año","ano"],
  departamento: ["departamento","depto"],
  seccion: ["seccion","seccion_electoral"],
  circuito: ["circuito","circuito_electoral"],
  mesa: ["mesa","numero_mesa"],
} as const;

export function buscarColumna(cols: string[], aliases: readonly string[]): string | null {
  const lower = new Map(cols.map(c => [c.toLowerCase(), c]));
  for (const a of aliases) { const c = lower.get(a); if (c) return c; }
  return null;
}

const quitaN = /^\s*N\s*[°º.]?\s*(?:DE\s+)?ORDEN\s+/i;
/** El padrón trae el encabezado "N ORDEN" pegado al inicio del nombre ("N ORDEN NIEVA GUIDO"). */
export const limpiarNombre = (s: string) => s.replace(quitaN, "").trim();

/** El primer número del domicilio es el N° de orden: "267 B°8 DE ABRIL PJE.20 850" → 267 + "B°8 DE ABRIL PJE.20 850". */
export function separarOrden(dom: string): { orden: string; domicilio: string } {
  const m = /^\s*(\d{1,6})(?:\s+(.*))?$/.exec(dom ?? "");
  return m ? { orden: m[1], domicilio: (m[2] ?? "").trim() } : { orden: "", domicilio: (dom ?? "").trim() };
}

const get = (f: Fila, aliases: readonly string[]) => {
  const k = buscarColumna(Object.keys(f), aliases);
  return k ? String(f[k] ?? "").trim() : "";
};

/** Fila lista para mostrar: nombre limpio, N° de orden separado del domicilio, y datos de afiliación. */
export interface Elector {
  dni: string; orden: string; nombre: string; domicilio: string;
  afiliado: boolean; fechaAfiliacion: string | null;
  extra: { clave: string; valor: string }[];     // resto de columnas (sección, circuito, mesa…)
}

export function aElector(f: Fila): Elector {
  const colOrden = buscarColumna(Object.keys(f), ALIAS.orden);
  const colDom = buscarColumna(Object.keys(f), ALIAS.domicilio);
  const colNom = buscarColumna(Object.keys(f), ALIAS.nombre);
  const colDni = buscarColumna(Object.keys(f), ALIAS.dni);

  let orden = colOrden ? String(f[colOrden] ?? "").trim() : "";
  let domicilio = colDom ? String(f[colDom] ?? "").trim() : "";
  if (!orden) { const s = separarOrden(domicilio); orden = s.orden; domicilio = s.domicilio; }

  const usadas = new Set([colOrden, colDom, colNom, colDni].filter(Boolean) as string[]);
  const extra = Object.keys(f)
    .filter(k => !usadas.has(k) && !k.startsWith("_"))
    .map(k => ({ clave: k, valor: String(f[k] ?? "").trim() }))
    .filter(x => x.valor);

  return {
    dni: colDni ? String(f[colDni] ?? "").trim() : "",
    orden, domicilio,
    nombre: limpiarNombre(colNom ? String(f[colNom] ?? "") : ""),
    afiliado: f._afiliado === true,
    fechaAfiliacion: typeof f._fecha_afil === "string" ? f._fecha_afil : null,
    extra,
  };
}

const ETIQUETAS: Record<string, string> = {
  seccion: "Sección", clase: "Año nacimiento", anio_nacimiento: "Año nacimiento", año_nacimiento: "Año nacimiento", ano_nacimiento: "Año nacimiento",
  tipo_doc: "Tipo documento", tipo_documento: "Tipo documento", depto: "Departamento",
  seccion_electoral: "Sección", circuito_electoral: "Circuito", numero_mesa: "Mesa",
};
export const etiqueta = (k: string) => ETIQUETAS[k.toLowerCase()] ?? k.replace(/_/g, " ").replace(/^./, c => c.toUpperCase());

/** Orden de las columnas "extra" en pantalla/CSV. */
const ORDEN_EXTRA = [...ALIAS.seccion, ...ALIAS.circuito, ...ALIAS.mesa, ...ALIAS.anio, ...ALIAS.departamento, "tipo_doc", "tipo_documento"];
export function ordenarExtra<T extends { clave: string }>(xs: T[]): T[] {
  const rank = (k: string) => { const i = ORDEN_EXTRA.indexOf(k.toLowerCase()); return i < 0 ? 999 : i; };
  return [...xs].sort((a, b) => rank(a.clave) - rank(b.clave));
}
