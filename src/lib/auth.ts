import { sql } from "@vercel/postgres";
import type { Rol } from "./session";

const ROLES: Rol[] = ["admin", "operador", "consulta"];

export const hayUsuarios = () => true;

export async function autenticar(nombre: string, password: string): Promise<{ nombre: string; rol: Rol } | null> {
  try {
    // Consultamos la tabla 'usuarios' en Neon
    const result = await sql`
      SELECT username, password, 'admin' as rol 
      FROM usuarios 
      WHERE LOWER(username) = LOWER(${nombre.trim()})
    `;

    if (result.rows.length === 0) {
      return null;
    }

    const u = result.rows[0];

    // Verificamos si la contraseña coincide directamente con la guardada en la base de datos
    if (u.password !== password) {
      return null;
    }

    return { nombre: u.username, rol: u.rol as Rol };
  } catch (error) {
    console.error("Error en autenticación contra Neon:", error);
    return null;
  }
}
