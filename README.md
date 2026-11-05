# 📋 Padrón Electoral — Santiago del Estero v5

Consulta del padrón electoral con **indicador de afiliación al Partido Justicialista**, listas de
afiliados / no afiliados con filtros y **descarga en CSV (Excel)**, todo detrás de **login**.

```
Navegador ─► Next.js (Vercel) ─► /api/* (sesión + permisos + límites + auditoría) ─► PostgreSQL / Neon
```

## Qué hace

| Pantalla | Qué muestra | Quién |
|---|---|---|
| **Consulta** | Búsqueda por DNI / nombre / dirección. La ficha dice **"Está afiliado / No está afiliado"** (con fecha de afiliación). | todos |
| **Listas y descargas** | Lista de **afiliados** y de **no afiliados**, filtros (nombre/DNI, departamento, sección, circuito, mesa), paginado y **Descargar CSV**. | `operador`, `admin` |
| **Estado de datos** | Totales, cruces y datos de la última carga. | `admin` |

* El **N° de orden** (primer número del domicilio, p. ej. `267 B°8 DE ABRIL PJE.20 850`) se muestra en su propio
  cuadro junto al DNI; el domicilio queda solo con la dirección. También se limpia el "N ORDEN" pegado al nombre.
* **Cruce de afiliación:** mismo DNI **y** mismo año de nacimiento cuando ambos lo tienen (en el padrón del PJ hay
  6 DNI repetidos entre personas distintas, p. ej. 4997619).
* El CSV usa `;` y UTF-8 con BOM (abre bien en Excel en español) y neutraliza fórmulas (`=`, `+`, `-`, `@`).

## Puesta en marcha

### 1. Base de datos (Neon)
1. Cree el proyecto en [neon.tech](https://neon.tech) y copie la connection string del **administrador**.
2. Cargue el padrón general (una vez): `pip install psycopg2-binary openpyxl` y
   `python migrate.py --csv padron_sde.csv --url "<URL_ADMIN>"`
3. Cree tablas y usuario de la app: `psql "<URL_ADMIN>" -f db/schema.sql` y edite/ejecute `db/roles.sql`
   (cambie la contraseña de `padron_app`).

### 2. Cargar el padrón de afiliados (XLSX o CSV)
```bash
export DATABASE_URL_ADMIN="<URL_ADMIN>"
python scripts/cargar_afiliados.py --archivo Padron_partido_justicialista_abril_26.xlsx --init
```
Descarta solos los renglones de encabezado/resumen, convierte fechas y reemplaza el padrón de afiliados
**de forma atómica** (si falla, no cambia nada). Con el archivo de abril 2026 carga **187.413** afiliados.
Use `--dry-run` para solo validar. Repita el comando cada vez que reciba un padrón nuevo.

### 3. Usuarios y secretos
```bash
node scripts/hash-password.mjs usuario1 admin        # pide la clave (mín. 12 caracteres) e imprime usuario1:admin:<hash>
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # SESSION_SECRET
```
Variables (Vercel → Settings → Environment Variables; ver `.env.example`):
`DATABASE_URL` (usuario `padron_app`), `SESSION_SECRET`, `AUTH_USERS` (`usuario:rol:hash;otro:rol:hash`).
**No** cargue `DATABASE_URL_ADMIN` en Vercel. Roles: `admin`, `operador`, `consulta`.

### 4. Desarrollo local / despliegue
```bash
cp .env.example .env.local   # completar
npm install && npm run dev   # http://localhost:3000
```
Subir a GitHub (**repositorio privado**) con `bash SUBIR_A_GITHUB.sh` e importar en Vercel.

## 🔒 Seguridad

| Problema en la versión anterior | Corrección |
|---|---|
| Sin autenticación: cualquiera con la URL consultaba el padrón | Login con **scrypt**, sesión firmada HMAC en cookie `HttpOnly` + `Secure` + `SameSite=Strict` (`__Host-`), **roles y permisos** por endpoint, middleware que bloquea todo sin sesión |
| Fuerza bruta | Bloqueo tras 5 intentos por usuario / 20 por IP (15 min) **guardado en la BD**; respuesta idéntica exista o no el usuario; hash señuelo contra enumeración por tiempos |
| Rate limit en memoria (inútil en serverless) y `X-Forwarded-For` falsificable | Contadores en PostgreSQL por usuario; IP tomada de cabeceras de la plataforma |
| Next.js 15.5.24 y dependencias con **vulnerabilidades críticas/altas** (cache poisoning, RCE en imágenes SVG, DoS en Server Actions, PostCSS, sharp) | Next **15.5.29**, `postcss` forzado ≥ 8.5.26: `npm audit` = **0 vulnerabilidades**. Se quitó `papaparse` (no se usaba) |
| CSP con `'unsafe-inline'` + `'unsafe-eval'` | CSP con **nonce por solicitud** + `strict-dynamic`, `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'none'` |
| La API devolvía `detalle` del error y el esquema de la BD (modo debug) y registraba consultas y datos personales en logs | Errores genéricos al cliente; logs sin datos personales; sin modo debug |
| Nombres de columna concatenados en SQL; `migrate.py` armaba SQL con encabezados del CSV (inyección) | Identificadores validados/escapados; `migrate.py` usa `psycopg2.sql`; todo dato del usuario va parametrizado; comodines `% _ \` escapados |
| Sin trazabilidad | Tabla `auditoria` (usuario, acción, criterios, IP) para logins, consultas, listas y descargas |
| Descargas masivas sin control | Permiso propio, 10 descargas / 10 min, tope de filas, CSV sin inyección de fórmulas |
| Usuario de BD con permisos amplios | `padron_app` solo `SELECT` en padrón/afiliados, `statement_timeout` 20 s; la carga usa otro usuario |
| `git add .` podía subir `.env` | `.gitignore` + `.env.example`; `SUBIR_A_GITHUB.sh` aborta si detecta secretos o `.csv/.xlsx` |
| Cabeceras | HSTS 2 años, `Referrer-Policy: no-referrer`, COOP/CORP, `Cache-Control: no-store`, sin `X-Powered-By` |

**Recomendaciones operativas:** repositorio privado; si alguna vez subió un `.env` o una URL de base de datos a GitHub,
**rote esas credenciales**; active 2FA en GitHub, Vercel y Neon; purgue `auditoria` periódicamente (ver `db/roles.sql`).
La afiliación política es un dato sensible (Ley 25.326): limite los usuarios `operador`/`admin` a quienes lo necesiten.
