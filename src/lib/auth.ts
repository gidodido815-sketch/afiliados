import { sql } from "@vercel/postgres";
import type { Rol } from "./session";

export const hayUsuarios = () => true;

export async function autenticar(nombre: string, password: string): Promise<{ nombre: string; rol: Rol } | null> {
  try {
    const result = await sql`
      SELECT username, password, 'admin' as rol 
      FROM usuarios 
      WHERE LOWER(username) = LOWER(${nombre.trim()})
    `;

    if (result.rows.length === 0) {
      return null;
    }

    const u = result.rows[0];

    // Validación directa de la contraseña en la base de datos
    if (u.password !== password) {
      return null;
    }

    return { nombre: u.username, rol: u.rol as Rol };
  } catch (error) {
    console.error("Error en autenticación contra Neon:", error);
    return null;
  }
}
