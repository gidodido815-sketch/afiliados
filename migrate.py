#!/usr/bin/env python3
"""
migrate.py — Carga el padrón electoral general (CSV) a PostgreSQL/Neon, tabla `electores`.

Uso:  python migrate.py --csv padron_sde.csv [--reemplazar]
La URL del ADMINISTRADOR se toma de --url o de DATABASE_URL_ADMIN (nunca la de la app web).

Cambios de seguridad respecto de la versión anterior:
  · Los nombres de columna del CSV se validan y se escapan con psycopg2.sql (antes se concatenaban
    en el SQL: un encabezado malicioso permitía inyección SQL).
  · Se corrigió la lectura del CSV (delimiter=None fallaba siempre) y se agregó --reemplazar
    para no duplicar registros al volver a cargar.
"""
import argparse, csv, io, os, re, sys, unicodedata
import psycopg2
from psycopg2 import sql

ALIAS = {
    "orden": "orden", "n_orden": "orden", "norden": "orden", "numero_orden": "orden",
    "matricula": "matricula", "dni": "matricula", "documento": "matricula", "nro_documento": "matricula", "numero_documento": "matricula",
    "apellido_nombre": "apellido_nombre", "apellido_y_nombre": "apellido_nombre", "nombre_completo": "apellido_nombre",
    "domicilio": "domicilio", "direccion": "domicilio", "domicilio_electoral": "domicilio",
    "clase": "clase", "anio_nacimiento": "anio_nacimiento", "ano_nacimiento": "anio_nacimiento",
    "seccion": "seccion", "seccion_electoral": "seccion", "circuito": "circuito", "circuito_electoral": "circuito",
    "mesa": "mesa", "numero_mesa": "mesa", "departamento": "departamento", "depto": "departamento",
    "tipo_doc": "tipo_documento", "tipo_documento": "tipo_documento",
    # metadatos que NO se cargan
    "archivo_origen": None, "archivo": None, "fuente": None, "path": None, "ruta": None, "file": None, "filename": None,
}
IDENT = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")


def normalizar(h):
    h = unicodedata.normalize("NFD", h.lower().strip())
    h = "".join(c for c in h if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "_", h).strip("_")


def leer(path):
    raw = open(path, "rb").read()
    for enc in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            txt = raw.decode(enc); break
        except UnicodeDecodeError:
            continue
    dialect = csv.Sniffer().sniff(txt[:4096], delimiters=",;\t|")
    r = csv.DictReader(io.StringIO(txt), dialect=dialect)
    return r.fieldnames or [], list(r)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True)
    ap.add_argument("--url", default=os.getenv("DATABASE_URL_ADMIN"))
    ap.add_argument("--reemplazar", action="store_true", help="vacía la tabla antes de cargar")
    a = ap.parse_args()
    if not a.url:
        sys.exit("Falta --url o DATABASE_URL_ADMIN")

    headers, rows = leer(a.csv)
    if not rows:
        sys.exit("No se pudo leer el CSV.")
    col_map = {}
    for h in headers:
        n = normalizar(h)
        dest = ALIAS.get(n, n)
        if dest is None:
            continue
        if not IDENT.match(dest):
            sys.exit(f"Encabezado no válido: {h!r}")
        col_map[h] = dest
    cols = sorted(set(col_map.values()))
    if "matricula" not in cols:
        sys.exit("El CSV debe tener una columna de DNI/matrícula.")
    print(f"{len(rows):,} registros · columnas: {cols}")

    conn = psycopg2.connect(a.url)
    with conn, conn.cursor() as cur:
        cur.execute(sql.SQL("CREATE TABLE IF NOT EXISTS electores (id SERIAL PRIMARY KEY, {})").format(
            sql.SQL(", ").join(sql.SQL("{} TEXT").format(sql.Identifier(c)) for c in cols)))
        if a.reemplazar:
            cur.execute("TRUNCATE electores RESTART IDENTITY")
        buf = io.StringIO(); w = csv.writer(buf, lineterminator="\n")
        for r in rows:
            m = {}
            for orig, dest in col_map.items():
                m[dest] = (r.get(orig) or "").strip()
            w.writerow([m.get(c, "") for c in cols])
        buf.seek(0)
        cur.copy_expert(sql.SQL("COPY electores ({}) FROM STDIN WITH (FORMAT csv)").format(
            sql.SQL(", ").join(sql.Identifier(c) for c in cols)).as_string(conn), buf)
        cur.execute("CREATE EXTENSION IF NOT EXISTS unaccent")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_electores_dni_norm ON electores "
                    "((regexp_replace(CAST(matricula AS TEXT), '\\D', '', 'g')))")
        cur.execute("ANALYZE electores")
    conn.close()
    print("✅ Padrón cargado. Ahora ejecute db/schema.sql y scripts/cargar_afiliados.py.")


if __name__ == "__main__":
    main()
