// Acceso a PostgreSQL. Neon (HTTP serverless) en producción; "pg" para Postgres local/propio.
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";

type Row = Record<string, unknown>;
let pool: Pool | null = null;
let neonSql: ReturnType<typeof neon> | null = null;

export class DbNoConfigurada extends Error {}

function usaNeon(url: string): boolean {
  if (process.env.DB_DRIVER === "pg") return false;
  if (process.env.DB_DRIVER === "neon") return true;
  try { return new URL(url).hostname.endsWith(".neon.tech"); } catch { return false; }
}

/** Ejecuta SQL parametrizado ($1, $2…). NUNCA concatenar datos del usuario en `text`. */
export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DbNoConfigurada("DATABASE_URL no configurada");

  if (usaNeon(url)) {
    neonSql ??= neon(url);
    return (await (neonSql as unknown as { query: (t: string, p: unknown[]) => Promise<T[]> }).query(text, params)) as T[];
  }
  pool ??= new Pool({
    connectionString: url, max: 5, idleTimeoutMillis: 10_000,
    statement_timeout: 20_000,
    ssl: process.env.DB_SSL === "false" || /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: true },
  });
  return (await pool.query(text, params)).rows as T[];
}

/** Identificador SQL entre comillas (los nombres de columna salen de information_schema y se validan). */
export function ident(name: string): string {
  if (!/^[\p{L}_][\p{L}\p{N}_ ]{0,62}$/u.test(name)) throw new Error("Identificador no válido");
  return `"${name.replace(/"/g, '""')}"`;
}

/** Escapa % _ \ para usar el texto del usuario dentro de un LIKE (evita comodines inyectados). */
export const escapeLike = (s: string) => s.replace(/[\\%_]/g, m => "\\" + m);
