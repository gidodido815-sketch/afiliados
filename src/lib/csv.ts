/** CSV para Excel (es-AR): separador ";", BOM UTF-8, y protección contra inyección de fórmulas. */
export const CSV_BOM = "﻿";
export function celda(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  // Fórmulas: =, +, -, @, tab, CR al inicio se ejecutarían en Excel → se neutralizan
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const fila = (vals: unknown[]) => vals.map(celda).join(";") + "\r\n";
