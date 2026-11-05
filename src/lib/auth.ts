// Solo Node (usa scrypt). Usuarios definidos en la variable AUTH_USERS.
import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import type { Rol } from "./session";

const N = 32768, R = 8, P = 1, KEYLEN = 64;

function derive(password: string, salt: Buffer, n = N, r = R, p = P): Promise<Buffer> {
  return new Promise((res, rej) =>
    scrypt(password.normalize("NFKC"), salt, KEYLEN, { N: n, r, p, maxmem: 128 * n * r * 2 }, (e, k) => (e ? rej(e) : res(k)))
  );
}

/** Formato: scrypt.N.r.p.<salt b64url>.<hash b64url>  (sin "$" para que dotenv no lo expanda) */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const h = await derive(password, salt);
  return ["scrypt", N, R, P, salt.toString("base64url"), h.toString("base64url")].join(".");
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

interface Usuario { nombre: string; rol: Rol; hash: string }
const ROLES: Rol[] = ["admin", "operador", "consulta"];

function usuarios(): Usuario[] {
  const out: Usuario[] = [];
  for (const parte of (process.env.AUTH_USERS ?? "").split(";")) {
    const t = parte.trim(); if (!t) continue;
    const [nombre, rol, hash] = t.split(":");
    if (nombre && hash && ROLES.includes(rol as Rol)) out.push({ nombre: nombre.trim().toLowerCase(), rol: rol as Rol, hash: hash.trim() });
  }
  return out;
}
export const hayUsuarios = () => usuarios().length > 0;

// Hash señuelo: el tiempo de respuesta no revela si el usuario existe
let DUMMY: Promise<string> | null = null;

export async function autenticar(nombre: string, password: string): Promise<{ nombre: string; rol: Rol } | null> {
  const u = usuarios().find(x => x.nombre === nombre.trim().toLowerCase());
  if (!u) {
    DUMMY ??= hashPassword("señuelo-" + randomBytes(8).toString("hex"));
    await verifyHash(password, await DUMMY);
    return null;
  }
  return (await verifyHash(password, u.hash)) ? { nombre: u.nombre, rol: u.rol } : null;
}
