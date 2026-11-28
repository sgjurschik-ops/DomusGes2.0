-- Nexo · Guía de cuidados (28/11/2026)
-- Pegar entero en Supabase → SQL Editor → Run.

CREATE TABLE IF NOT EXISTS "CareGuide" (
  "id"          TEXT         NOT NULL,
  "patientId"   TEXT         NOT NULL,
  "data"        TEXT         NOT NULL DEFAULT '{}',
  "updatedById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CareGuide_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CareGuide_patientId_key" ON "CareGuide"("patientId");
ALTER TABLE "CareGuide" ADD CONSTRAINT "CareGuide_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareGuide" ADD CONSTRAINT "CareGuide_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CareGuide" ENABLE ROW LEVEL SECURITY;

-- Comprobación: debe salir una fila con rowsecurity = true.
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'CareGuide';
