#!/usr/bin/env python3
"""
cargar_afiliados.py — Carga el padrón de afiliados del Partido Justicialista (XLSX o CSV) en PostgreSQL.

Uso:
  python scripts/cargar_afiliados.py --archivo Padron_partido_justicialista_abril_26.xlsx --init
  python scripts/cargar_afiliados.py --archivo padron.xlsx --dry-run        # solo valida, no toca la BD

La URL del ADMINISTRADOR se toma de --url o de la variable DATABASE_URL_ADMIN (nunca la de la app web).
La carga es ATÓMICA: se reemplaza todo el padrón de afiliados en una sola transacción; si algo falla no
cambia nada. Se descartan automáticamente los renglones de encabezado y de resumen del Excel.
"""
import argparse, csv, datetime as dt, hashlib, io, os, re, sys, unicodedata
from pathlib import Path

COLS = ["matricula", "tipo_doc", "apellido", "nombre", "genero", "clase", "fecha_nacimiento",
        "fecha_afiliacion", "fecha_domicilio", "domicilio", "seccion", "cod_seccion", "circuito", "cod_circuito"]

# Encabezado del Excel (sin tildes, minúsculas) → columna destino
HEADERS = {
    "matricula": "matricula", "dni": "matricula", "documento": "matricula",
    "tipo documento": "tipo_doc", "tipo_doc": "tipo_doc",
    "apellido": "apellido", "nombre": "nombre", "genero": "genero",
    "clase": "clase", "fecha nacimiento": "fecha_nacimiento", "fecha afiliacion": "fecha_afiliacion",
    "fecha domicilio": "fecha_domicilio", "domicilio": "domicilio",
    "seccion": "seccion", "cod. seccion": "cod_seccion",
    "circuito": "circuito", "cod. circuito": "cod_circuito",
}
EPOCH = dt.date(1899, 12, 30)  # origen de fechas seriales de Excel


def fecha(v):
    """Fecha ISO o '' si falta o es implausible (el padrón trae algún año tipeado mal, p. ej. 1198)."""
    f = _fecha(v)
    return f if f and "1900-01-01" <= f <= dt.date.today().isoformat() else ""


def _fecha(v):
    if v in (None, ""):
        return ""
    if isinstance(v, dt.datetime):
        return v.date().isoformat()
    if isinstance(v, dt.date):
        return v.isoformat()
    s = str(v).strip()
    if re.fullmatch(r"\d{4,6}", s):                      # serial de Excel
        n = int(s)
        return (EPOCH + dt.timedelta(days=n)).isoformat() if 1000 < n < 80000 else ""
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", s)
    if m:
        try:
            return dt.date(int(m[3]), int(m[2]), int(m[1])).isoformat()
        except ValueError:
            return ""
    return s if re.fullmatch(r"\d{4}-\d{2}-\d{2}", s) else ""


def sin_tildes(s):
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def texto(v):
    return "" if v is None else re.sub(r"\s+", " ", str(v)).strip()


def leer_filas(path: Path):
    """Genera dicts con las columnas destino. Descarta encabezados repetidos, resúmenes y filas sin DNI."""
    descartadas = 0
    if path.suffix.lower() in (".xlsx", ".xlsm"):
        import openpyxl
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        filas = (list(r) for r in wb.worksheets[0].iter_rows(values_only=True))
    else:
        raw = path.read_bytes()
        for enc in ("utf-8-sig", "cp1252", "latin-1"):
            try:
                s = raw.decode(enc); break
            except UnicodeDecodeError:
                continue
        dialect = csv.Sniffer().sniff(s[:4096], delimiters=",;\t|")
        filas = (r for r in csv.reader(io.StringIO(s), dialect))
    mapa = None
    for r in filas:
        celdas = [texto(c) for c in r]
        low = [sin_tildes(c).lower() for c in celdas]
        if "matricula" in low:           # fila de encabezado (se repite por circuito)
            mapa = {i: HEADERS[c] for i, c in enumerate(low) if c in HEADERS}
            continue
        if mapa is None:
            descartadas += 1; continue
        d = {COLS[i]: "" for i in range(len(COLS))}
        for i, dest in mapa.items():
            if i < len(r):
                d[dest] = r[i]
        dni = re.sub(r"\D", "", texto(d["matricula"]))
        if not dni or len(dni) > 12:                           # resúmenes, títulos, filas vacías
            descartadas += 1; continue
        out = {k: texto(v) for k, v in d.items()}
        out["matricula"] = dni
        for k in ("fecha_nacimiento", "fecha_afiliacion", "fecha_domicilio"):
            out[k] = fecha(d[k])
        out["clase"] = out["clase"] if re.fullmatch(r"\d{4}", out["clase"]) else ""
        yield out, descartadas


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--archivo", required=True)
    ap.add_argument("--url", default=os.getenv("DATABASE_URL_ADMIN"))
    ap.add_argument("--init", action="store_true", help="crea tablas e índices (db/schema.sql) antes de cargar")
    ap.add_argument("--dry-run", action="store_true", help="solo valida el archivo")
    a = ap.parse_args()
    path = Path(a.archivo)
    if not path.is_file():
        sys.exit(f"No existe el archivo: {path}")

    print(f"Leyendo {path.name} …")
    buf, n, desc = io.StringIO(), 0, 0
    w = csv.writer(buf, lineterminator="\n")
    for fila, desc in leer_filas(path):
        w.writerow([fila[c] for c in COLS]); n += 1
        if n % 50000 == 0:
            print(f"  …{n:,} filas válidas")
    print(f"Filas válidas: {n:,} · descartadas (encabezados/resúmenes/vacías): {desc:,}")
    if n == 0:
        sys.exit("No se encontraron afiliados. Revise el formato del archivo.")
    if a.dry_run:
        print("Dry-run: no se modificó la base de datos."); return
    if not a.url:
        sys.exit("Falta la URL de administrador (--url o variable DATABASE_URL_ADMIN).")

    import psycopg2
    sha = hashlib.sha256(path.read_bytes()).hexdigest()
    conn = psycopg2.connect(a.url)
    try:
        with conn, conn.cursor() as cur:                      # una sola transacción: todo o nada
            if a.init:
                cur.execute((Path(__file__).resolve().parent.parent / "db" / "schema.sql").read_text(encoding="utf-8"))
            cur.execute("TRUNCATE afiliados RESTART IDENTITY")
            buf.seek(0)
            cur.copy_expert(
                f"COPY afiliados ({', '.join(COLS)}) FROM STDIN WITH (FORMAT csv, NULL '')", buf)
            # los campos vacíos de fecha/clase llegan como NULL (NULL '' en COPY csv)
            cur.execute("SELECT count(*) FROM afiliados")
            cargadas = cur.fetchone()[0]
            if cargadas != n:
                raise RuntimeError(f"Conteo distinto: archivo {n} vs base {cargadas}")
            cur.execute("INSERT INTO cargas_afiliados (archivo, sha256, filas, descartadas) VALUES (%s,%s,%s,%s)",
                        (path.name, sha, cargadas, desc))
            cur.execute("ANALYZE afiliados")
        print(f"✅ Carga completa: {cargadas:,} afiliados en la base de datos.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
