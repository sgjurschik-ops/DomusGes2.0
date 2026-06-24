// Seed script — fake but realistic Spanish occupational-therapy demo data.
// NO REAL PATIENT DATA. Run with `bun run db:seed`.

import { PrismaClient, type Patient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const PALETTE = ["#1a5c58", "#5b3fa0", "#c17f3a", "#b03060", "#2a6b3f", "#1a5c80"];

async function main() {
  console.log("→ Limpieza previa…");
  await db.auditLog.deleteMany();
  await db.appointment.deleteMany();
  await db.assessment.deleteMany();
  await db.visit.deleteMany();
  await db.patient.deleteMany();
  await db.professional.deleteMany();

  // ─── Profesionales (contraseñas hasheadas con bcrypt) ──────────────────────
  const pwHash = (pw: string) => bcrypt.hashSync(pw, 10);
  const admin = await db.professional.create({
    data: {
      email: "admin@domusges.es",
      name: "Sara Administradora",
      role: "Administrador",
      numColegiado: "—",
      phone: "600 000 000",
      passwordHash: pwHash("admin2026"),
      isAdmin: true,
      color: "#1c2d32",
    },
  });
  const ana = await db.professional.create({
    data: {
      email: "ana@domusges.es",
      name: "Ana Moreno",
      role: "Fisioterapeuta",
      numColegiado: "PF-1234",
      phone: "612 111 222",
      passwordHash: pwHash("demo2026"),
      color: PALETTE[0],
    },
  });
  const carlos = await db.professional.create({
    data: {
      email: "carlos@domusges.es",
      name: "Carlos Ruiz",
      role: "Psicólogo/a Clínico/a",
      numColegiado: "PC-5678",
      phone: "633 333 444",
      passwordHash: pwHash("demo2026"),
      color: PALETTE[1],
    },
  });
  const laura = await db.professional.create({
    data: {
      email: "laura@domusges.es",
      name: "Laura Vega",
      role: "Terapeuta Ocupacional",
      numColegiado: "TO-9012",
      phone: "644 555 666",
      passwordHash: pwHash("demo2026"),
      color: PALETTE[2],
    },
  });
  console.log("✓ Profesionales creados (admin@domusges.es / admin2026, ana/carlos/laura@domusges.es / demo2026)");

  // ─── Pacientes (datos claramente ficticios) ────────────────────────────────
  const patients: Prisma.PatientCreateInput[] = [
    {
      firstName: "Marta", lastName: "Ejemplo Uno", birthDate: new Date("1958-03-12"),
      specialty: "Fisioterapia", status: "Activo",
      phone: "612 345 678", address: "Calle Demo 12, 1ºA — Pamplona",
      diagnosis: "Fractura de cadera derecha — post-quirúrgico",
      objective: "Recuperación de movilidad y prevención de caídas",
      startDate: new Date("2026-02-12"),
      therapists: { connect: [{ id: ana.id }] },
      color: PALETTE[0],
    },
    {
      firstName: "Joaquín", lastName: "Ejemplo Dos", birthDate: new Date("1981-07-23"),
      specialty: "Psicología", status: "En seguimiento",
      phone: "689 012 345", address: "Av. Demo 45, 3ºB — Pamplona",
      diagnosis: "Trastorno adaptativo con componente ansioso",
      objective: "Manejo del estrés y reestructuración cognitiva",
      startDate: new Date("2026-03-15"),
      therapists: { connect: [{ id: carlos.id }] },
      color: PALETTE[1],
    },
    {
      firstName: "Cándida", lastName: "Ejemplo Tres", birthDate: new Date("1944-09-04"),
      specialty: "T. Ocupacional", status: "Activo",
      phone: "654 789 012", address: "C/ Demo 8, 2ºC — Pamplona",
      diagnosis: "Deterioro cognitivo leve (DCL)",
      objective: "Mantenimiento de AVD e independencia funcional",
      startDate: new Date("2025-10-05"),
      therapists: { connect: [{ id: laura.id }] },
      color: PALETTE[2],
    },
    {
      firstName: "Atilano", lastName: "Ejemplo Cuatro", birthDate: new Date("1955-01-30"),
      specialty: "Fisioterapia", status: "En seguimiento",
      phone: "638 456 789", address: "Calle Demo 15, 1ºD — Pamplona",
      diagnosis: "Ictus isquémico — secuelas motoras lado izquierdo",
      objective: "Rehabilitación neuromotora y autonomía en la marcha",
      startDate: new Date("2025-09-18"),
      therapists: { connect: [{ id: ana.id }] },
      color: PALETTE[3],
    },
    {
      firstName: "Lorena", lastName: "Ejemplo Cinco", birthDate: new Date("1992-11-08"),
      specialty: "Psicología", status: "Activo",
      phone: "601 234 567", address: "C/ Demo 52, 4ºA — Pamplona",
      diagnosis: "TDAH adulto — desregulación emocional",
      objective: "Técnicas de autorregulación y planificación ejecutiva",
      startDate: new Date("2026-01-20"),
      therapists: { connect: [{ id: carlos.id }] },
      color: PALETTE[4],
    },
    {
      firstName: "Manuel", lastName: "Ejemplo Seis", birthDate: new Date("1949-05-19"),
      specialty: "T. Ocupacional", status: "Activo",
      phone: "677 890 123", address: "Calle Demo 28, 3ºB — Pamplona",
      diagnosis: "Enfermedad de Parkinson — estadio II",
      objective: "Adaptación del entorno y mantenimiento de habilidades motoras finas",
      startDate: new Date("2025-11-14"),
      therapists: { connect: [{ id: laura.id }] },
      color: PALETTE[5],
    },
  ];
  const patientRows: Patient[] = [];
  for (const p of patients) {
    patientRows.push(await db.patient.create({ data: p }));
  }
  console.log(`✓ ${patientRows.length} pacientes ficticios creados`);

  // ─── Visitas (3 por paciente, en las últimas 6 semanas) ────────────────────
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
  let visitCount = 0;
  for (const [idx, p] of patientRows.entries()) {
    const prof = await db.patient.findUnique({ where: { id: p.id }, include: { therapists: true } });
    if (!prof || prof.therapists.length === 0) continue;
    const therapistId = prof.therapists[0].id;
    const baseInterventions: Record<string, string[]> = {
      Fisioterapia: ["Ejercicios activos asistidos", "Electroterapia TENS", "Reeducación de marcha"],
      Psicología: ["Reestructuración cognitiva", "Respiración diafragmática", "Registro de pensamientos"],
      "T. Ocupacional": ["AVD básicas", "Estimulación cognitiva", "Adaptación de entorno"],
    };
    const interventions = baseInterventions[p.specialty] ?? [];
    for (let i = 0; i < 3; i++) {
      await db.visit.create({
        data: {
          patientId: p.id,
          therapistId,
          date: daysAgo(i * 7 + 3),
          durationMin: 45 + (i % 3) * 15,
          notes:
            `Sesión de seguimiento. ` +
            `Paciente ${p.firstName} evoluciona de forma favorable. ` +
            `Se refuerzan pautas de autocuidado y se planifica siguiente visita. ` +
            `Notas internas para el terapeuta: revisar evolución del objetivo "${p.objective?.toLowerCase() ?? "general"}".`,
          interventions: JSON.stringify(interventions),
          score: 5 + ((idx + i) % 4),
        },
      });
      visitCount++;
    }
  }
  console.log(`✓ ${visitCount} visitas creadas`);

  // ─── Evaluaciones (escala según especialidad) ──────────────────────────────
  const scaleBySpecialty: Record<string, string[]> = {
    Fisioterapia: ["EVN", "Barthel"],
    Psicología: ["PHQ-9", "GAD-7"],
    "T. Ocupacional": ["Lawton-Brody", "Barthel", "Mini-Mental"],
  };
  for (const p of patientRows) {
    const prof = await db.patient.findUnique({ where: { id: p.id }, include: { therapists: true } });
    if (!prof || prof.therapists.length === 0) continue;
    const therapistId = prof.therapists[0].id;
    const scales = scaleBySpecialty[p.specialty] ?? [];
    for (let i = 0; i < 4; i++) {
      const scale = scales[i % scales.length] ?? "EVN";
      const score =
        scale === "Barthel" ? `${60 + i * 10}/100` :
        scale === "Lawton-Brody" ? `${4 + (i % 4)}/8` :
        scale === "PHQ-9" ? `${8 + i * 2}/27` :
        scale === "GAD-7" ? `${5 + i}/21` :
        scale === "Mini-Mental" ? `${24 + (i % 4)}/30` :
        `${3 + i}/10`;
      await db.assessment.create({
        data: {
          patientId: p.id,
          therapistId,
          scale,
          score,
          notes: i === 0 ? "Evaluación inicial." : "Reevaluación de seguimiento.",
          date: daysAgo(i * 21 + 5),
        },
      });
    }
  }
  console.log("✓ Evaluaciones creadas");

  // ─── Citas (pasadas y futuras) ─────────────────────────────────────────────
  const today10 = new Date(now);
  today10.setHours(10, 30, 0, 0);
  const today12 = new Date(now);
  today12.setHours(12, 0, 0, 0);
  const today16 = new Date(now);
  today16.setHours(16, 0, 0, 0);
  const tomorrow11 = new Date(now.getTime() + 86400000);
  tomorrow11.setHours(11, 0, 0, 0);
  const in2days = new Date(now.getTime() + 2 * 86400000);
  in2days.setHours(9, 30, 0, 0);
  const in3days = new Date(now.getTime() + 3 * 86400000);
  in3days.setHours(15, 0, 0, 0);

  const appts = [
    { p: patientRows[0], prof: ana, start: today10, type: "Sesión" },
    { p: patientRows[4], prof: carlos, start: today12, type: "Sesión" },
    { p: patientRows[2], prof: laura, start: today16, type: "Sesión" },
    { p: patientRows[1], prof: carlos, start: tomorrow11, type: "Seguimiento" },
    { p: patientRows[3], prof: ana, start: in2days, type: "Sesión" },
    { p: patientRows[5], prof: laura, start: in3days, type: "Seguimiento" },
  ];
  for (const a of appts) {
    await db.appointment.create({
      data: {
        patientId: a.p.id,
        therapistId: a.prof.id,
        start: a.start,
        durationMin: 45,
        type: a.type,
        status: "programada",
      },
    });
  }
  console.log(`✓ ${appts.length} citas creadas (hoy: 3)`);

  // ─── Audit log inicial ─────────────────────────────────────────────────────
  await db.auditLog.create({
    data: {
      professionalId: admin.id,
      action: "system.seed",
      entityType: "System",
      entityId: null,
      metadata: JSON.stringify({ patients: patientRows.length, professionals: 4 }),
    },
  });
  console.log("✓ Audit log inicial");
  console.log("\n✅ Seed completado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
