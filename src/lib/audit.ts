import { query } from "./db";

/** Registro de auditoría. No debe romper la operación si falla, pero deja constancia en el log del servidor. */
export async function auditar(usuario: string | null, accion: string, detalle: string, ip: string) {
  try {
    await query("INSERT INTO auditoria (usuario, accion, detalle, ip) VALUES ($1, $2, $3, $4)",
      [usuario, accion, detalle.slice(0, 500), ip]);
  } catch {
    console.error("[auditoria] no se pudo registrar:", accion);
  }
}
