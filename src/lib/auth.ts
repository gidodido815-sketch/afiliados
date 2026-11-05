import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { sql } from "@vercel/postgres";
import type { Rol } from "./session";

const N = 32768, R = 8, P = 1, KEYLEN = 64;

function derive(password: string, salt: Buffer, n = N, r = R, p = P): Promise<Buffer> {
  return new Promise((res, rej) =>
    scrypt(password.normalize("NFKC"), salt, KEYLEN, { N: n, r, p, maxmem: 128 * n * r * 2 }, (e, k) => (e ? rej(e) : res(k)))
  );
}

async function verifyHash(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, s, h] = stored.split(".");
  if (alg !== "scrypt" || !s || !h) return false;
  const nn = Number(n), rr = Number(r), pp = Number(p);
  if (![nn, rr, pp].every(Number.isInteger) || nn > 2 ** 20 || nn < 2 ** 12) return false;
  const expected = Buffer.from(h, "base64url");
  const got = await derive(password, Buffer.from(s, "base64url"), nn, rr, pp);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export const hayUsuarios = () => true; // Como usaremos Neon, siempre hay servicio

export async function autenticar(nombre: string, password: string): Promise<{ nombre: string; rol: Rol } | null> {
  try {
    // Consultamos directamente la tabla 'usuarios' que creamos en Neon
    const result = await sql`
      SELECT username, password as hash, 'admin' as rol 
      FROM usuarios 
      WHERE LOWER(username) = LOWER(${nombre.trim()})
    `;

    if (result.rows.length === 0) {
      return null;
    }

    const u = result.rows[0];
    
    // Si guardaste las contraseñas en texto plano para prueba o usando hash de scrypt:
    // (Si en la base de Neon pusiste la contraseña plana temporalmente, validamos directo o con verifyHash)
    // Asumiendo que validamos contra el campo hash de tu tabla:
    const passwordMatch = await verifyHash(password, u.hash).catch(() => false);
    
    // Si prefieres validación directa por texto plano mientras configuras el hash:
    // const passwordMatch = (password === u.hash);

    if (!passwordMatch) {
      return null;
    }

    return { nombre: u.username, rol: u.rol as Rol };
  } catch (error) {
    console.error("Error en autenticación contra Neon:", error);
    return null;
  }
}
