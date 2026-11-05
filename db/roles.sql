-- =============================================================================
--  Usuario de la APLICACIÓN WEB con mínimo privilegio (ejecutar como ADMIN)
--  Reemplace la contraseña. NO puede modificar el padrón ni los afiliados.
-- =============================================================================
CREATE USER padron_app WITH PASSWORD 'CAMBIAR-por-una-clave-larga-y-aleatoria';
GRANT CONNECT ON DATABASE neondb TO padron_app;          -- cambie neondb si su BD se llama distinto
GRANT USAGE ON SCHEMA public TO padron_app;

GRANT SELECT ON electores, afiliados, cargas_afiliados TO padron_app;
GRANT INSERT ON auditoria TO padron_app;
GRANT USAGE ON SEQUENCE auditoria_id_seq TO padron_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON rate_limit TO padron_app;

-- Corta consultas lentas o abusivas (DoS por búsquedas costosas)
ALTER ROLE padron_app SET statement_timeout = '20s';
ALTER ROLE padron_app SET idle_in_transaction_session_timeout = '10s';

-- Retención de auditoría (ejecutar periódicamente como admin), p. ej. 12 meses:
-- DELETE FROM auditoria WHERE ts < now() - interval '12 months';
