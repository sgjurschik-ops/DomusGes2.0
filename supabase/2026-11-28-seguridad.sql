-- Nexo · Seguridad (28/11/2026)
-- Pegar entero en Supabase → SQL Editor → Run.

-- 1) Columnas para el bloqueo temporal tras 5 intentos de inicio de sesión fallidos.
ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "failedLoginCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Professional" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

-- 2) Activar RLS en todas las tablas: nadie puede leerlas desde fuera con las
--    claves públicas de Supabase. La app no se ve afectada porque se conecta
--    desde el servidor con el usuario "postgres", que no está sujeto a RLS.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

-- Comprobación: todas las filas deben salir con rowsecurity = true.
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
