-- =============================================================================
--  Esquema de la aplicación (ejecutar UNA vez con el usuario ADMINISTRADOR)
--  psql "$DATABASE_URL_ADMIN" -f db/schema.sql      (o: cargar_afiliados.py --init)
-- =============================================================================

-- Padrón de afiliados al Partido Justicialista (se reemplaza completo en cada carga)
CREATE TABLE IF NOT EXISTS afiliados (
    id               BIGSERIAL PRIMARY KEY,
    matricula        TEXT    NOT NULL CHECK (matricula ~ '^[0-9]{1,12}$'),  -- solo dígitos
    tipo_doc         TEXT,
    apellido         TEXT,
    nombre           TEXT,
    genero           TEXT,
    clase            INTEGER,            -- año de nacimiento
    fecha_nacimiento DATE,
    fecha_afiliacion DATE,
    fecha_domicilio  DATE,
    domicilio        TEXT,
    seccion          TEXT,
    cod_seccion      TEXT,
    circuito         TEXT,
    cod_circuito     TEXT
);
-- Hay DNI repetidos entre personas distintas (p.ej. 4997619 hombre y mujer): NO es único.
CREATE INDEX IF NOT EXISTS idx_afiliados_matricula ON afiliados (matricula);

-- Historial de cargas del padrón de afiliados
CREATE TABLE IF NOT EXISTS cargas_afiliados (
    id         BIGSERIAL PRIMARY KEY,
    fecha      TIMESTAMPTZ NOT NULL DEFAULT now(),
    archivo    TEXT,
    sha256     TEXT,
    filas      INTEGER NOT NULL,
    descartadas INTEGER NOT NULL DEFAULT 0
);

-- Auditoría: quién consultó / descargó qué
CREATE TABLE IF NOT EXISTS auditoria (
    id      BIGSERIAL PRIMARY KEY,
    ts      TIMESTAMPTZ NOT NULL DEFAULT now(),
    usuario TEXT,
    accion  TEXT NOT NULL,
    detalle TEXT,
    ip      TEXT
);
CREATE INDEX IF NOT EXISTS idx_auditoria_ts ON auditoria (ts DESC);

-- Contadores para limitar intentos (login y API). Ventanas fijas, funcionan en serverless.
CREATE TABLE IF NOT EXISTS rate_limit (
    clave   TEXT   NOT NULL,
    ventana BIGINT NOT NULL,
    n       INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (clave, ventana)
);

-- Índice sobre el DNI normalizado del padrón general (acelera el cruce con afiliados).
-- Si su columna de DNI no se llama "matricula", ajuste el nombre.
CREATE INDEX IF NOT EXISTS idx_electores_dni_norm
    ON electores ((regexp_replace(CAST(matricula AS TEXT), '\D', '', 'g')));
