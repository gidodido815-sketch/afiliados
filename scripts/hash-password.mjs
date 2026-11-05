#!/usr/bin/env node
// Genera el hash scrypt para la variable AUTH_USERS.
//   node scripts/hash-password.mjs            (pide la clave sin mostrarla)
//   node scripts/hash-password.mjs usuario rol   → imprime la entrada completa "usuario:rol:hash"
import { scrypt, randomBytes } from "node:crypto";

const N = 32768, R = 8, P = 1;
const [usuario, rol] = process.argv.slice(2);

function pedirClave() {
  return new Promise(resolve => {
    process.stderr.write("Clave (mínimo 12 caracteres): ");
    const stdin = process.stdin; let s = "";
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume(); stdin.setEncoding("utf8");
    stdin.on("data", function onData(ch) {
      for (const c of ch) {
        if (c === "\r" || c === "\n" || c === "\u0004") { if (stdin.isTTY) stdin.setRawMode(false); stdin.pause(); stdin.off("data", onData); process.stderr.write("\n"); return resolve(s); }
        if (c === "\u0003") process.exit(130);
        if (c === "\u007f") s = s.slice(0, -1); else s += c;
      }
    });
  });
}

const clave = await pedirClave();
if (clave.length < 12) { console.error("La clave debe tener al menos 12 caracteres."); process.exit(1); }
const salt = randomBytes(16);
scrypt(clave.normalize("NFKC"), salt, 64, { N, r: R, p: P, maxmem: 128 * N * R * 2 }, (e, k) => {
  if (e) throw e;
  const hash = ["scrypt", N, R, P, salt.toString("base64url"), k.toString("base64url")].join(".");
  console.log(usuario && rol ? `${usuario}:${rol}:${hash}` : hash);
});
