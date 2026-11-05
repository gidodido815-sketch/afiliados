import { sql } from "@vercel/postgres";

export const hayUsuarios = () => true;

export async function autenticar(nombre: string, password: string): Promise<{ nombre: string; rol: string } | null> {
  try {
    const result = await sql`
      SELECT username, password 
      FROM usuarios 
      WHERE LOWER(username) = LOWER(${nombre.trim()})
    `;

    if (!result || result.rows.length === 0) {
      return null;
    }

    const u = result.rows[0];

    if (u.password !== password) {
      return null;
    }

    return { nombre: u.username, rol: "admin" };
  } catch (error) {
    console.error("Error en autenticación:", error);
    return null;
  }
}
