import { query } from "./db";

/** Contador de ventana fija en la BD (funciona entre instancias serverless, a diferencia de un Map en memoria). */
function ventanaInicio(seg: number) { const t = Math.floor(Date.now() / 1000); return t - (t % seg); }

export async function contar(clave: string, ventanaSeg: number): Promise<number> {
  const r = await query<{ n: number }>("SELECT n FROM rate_limit WHERE clave = $1 AND ventana = $2", [clave, ventanaInicio(ventanaSeg)]);
  return r[0]?.n ?? 0;
}

export async function registrar(clave: string, ventanaSeg: number): Promise<number> {
  const r = await query<{ n: number }>(
    `INSERT INTO rate_limit (clave, ventana, n) VALUES ($1, $2, 1)
     ON CONFLICT (clave, ventana) DO UPDATE SET n = rate_limit.n + 1 RETURNING n`,
    [clave, ventanaInicio(ventanaSeg)]
  );
  if (Math.random() < 0.02) // limpieza ocasional
    await query("DELETE FROM rate_limit WHERE ventana < $1", [Math.floor(Date.now() / 1000) - 86_400]).catch(() => {});
  return r[0]?.n ?? 1;
}

export async function reiniciar(clave: string) {
  await query("DELETE FROM rate_limit WHERE clave = $1", [clave]).catch(() => {});
}

/** Cuenta y limita. true = permitido. */
export async function limitar(clave: string, max: number, ventanaSeg: number): Promise<boolean> {
  return (await registrar(clave, ventanaSeg)) <= max;
}
