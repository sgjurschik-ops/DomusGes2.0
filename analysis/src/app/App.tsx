import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, Users, CalendarDays, FileText, Settings,
  MapPin, Phone, ArrowLeft, Search, Plus, Bell, ClipboardList,
  TrendingUp, CheckCircle2, AlertCircle, Menu, X, Activity,
  Clock, ChevronRight, ChevronLeft, User, Home, Pencil, Trash2, Mail,
  BadgeCheck, ToggleLeft, ToggleRight, UserPlus, Users2, Filter, Download, ClipboardCheck,
  Navigation2, LogOut, Eye, EyeOff, KeyRound, ArrowRight, Receipt,
} from "lucide-react";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  format, parse, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, addDays, addWeeks, addMonths,
  isSameDay, isSameMonth,
} from "date-fns";
import { es } from "date-fns/locale";

// ─── Types ──────────────────────────────────────────────────────────────────

type Specialty = "Fisioterapia" | "Psicología" | "T. Ocupacional";
type Status = "Activo" | "En seguimiento" | "Alta" | "Pausado";
type View = "dashboard" | "patients" | "patient-detail" | "new-visit" | "new-patient" | "equipo" | "calendar" | "reports" | "settings" | "today" | "admin-users" | "facturacion";

interface Patient {
  id: string;
  name: string;
  age: number;
  birthDate?: string;
  specialty: Specialty;
  status: Status;
  phone: string;
  address: string;
  diagnosis: string;
  objective: string;
  therapist: string;
  therapistIds?: string[];
  referentName?: string;
  referentPhone?: string;
  nextVisit: string;
  lastVisit: string;
  totalVisits: number;
  startDate: string;
  color: string;
}
interface Visit {
  id: string;
  patientId: string;
  date: string;
  time: string;
  duration: number;
  notes: string;
  interventions: string[];
  score: number;
}
interface ProgressPoint {
  mes: string;
  dolor?: number;
  funcional?: number;
  animo?: number;
  autonomia?: number;
}

const PROF_ROLES = [
  "Fisioterapeuta",
  "Terapeuta Ocupacional",
  "Psicólogo/a Clínico/a",
  "Enfermero/a",
  "Médico/a",
  "Trabajador/a Social",
  "Logopeda",
  "Auxiliar de Enfermería",
  "TCAE",
  "Otro",
] as const;
type ProfRole = typeof PROF_ROLES[number];

interface Professional {
  id: string;
  name: string;
  role: ProfRole | string;
  numColegiado: string;
  phone: string;
  email: string;
  active: boolean;
  color: string;
  joined: string;
  password?: string;
  isAdmin?: boolean;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const patients: Patient[] = [
  {
    id: "p1", name: "María García López", age: 68, specialty: "Fisioterapia", status: "Activo",
    phone: "612 345 678", address: "Calle Estafeta 12, 1ºA — Pamplona",
    diagnosis: "Fractura de cadera derecha — post-quirúrgico",
    objective: "Recuperación de movilidad y prevención de caídas",
    therapist: "Ana Moreno", nextVisit: "Hoy, 10:30", lastVisit: "03 jun 2026",
    totalVisits: 14, startDate: "12 feb 2026", color: "#1a5c58",
  },
  {
    id: "p2", name: "José Antonio Martínez", age: 45, specialty: "Psicología", status: "En seguimiento",
    phone: "689 012 345", address: "Av. Carlos III 45, 3ºB — Pamplona",
    diagnosis: "Trastorno adaptativo con componente ansioso",
    objective: "Manejo del estrés y reestructuración cognitiva",
    therapist: "Carlos Ruiz", nextVisit: "Mañana, 11:00", lastVisit: "02 jun 2026",
    totalVisits: 8, startDate: "15 mar 2026", color: "#5b3fa0",
  },
  {
    id: "p3", name: "Carmen Rodríguez Pérez", age: 82, specialty: "T. Ocupacional", status: "Activo",
    phone: "654 789 012", address: "C/ Navas de Tolosa 8, 2ºC — Pamplona",
    diagnosis: "Deterioro cognitivo leve (DCL)",
    objective: "Mantenimiento de AVD e independencia funcional",
    therapist: "Laura Vega", nextVisit: "Hoy, 16:00", lastVisit: "01 jun 2026",
    totalVisits: 22, startDate: "05 oct 2025", color: "#c17f3a",
  },
  {
    id: "p4", name: "Antonio Fernández Cruz", age: 71, specialty: "Fisioterapia", status: "En seguimiento",
    phone: "638 456 789", address: "Calle Aoiz 15, 1ºD — Pamplona",
    diagnosis: "Ictus isquémico — secuelas motoras lado izquierdo",
    objective: "Rehabilitación neuromotora y autonomía en la marcha",
    therapist: "Ana Moreno", nextVisit: "06 jun 2026", lastVisit: "30 may 2026",
    totalVisits: 31, startDate: "18 sep 2025", color: "#b03060",
  },
  {
    id: "p5", name: "Lucía Torres Vega", age: 33, specialty: "Psicología", status: "Activo",
    phone: "601 234 567", address: "C/ Marcelo Celayeta 52, 4ºA — Pamplona",
    diagnosis: "TDAH adulto — desregulación emocional",
    objective: "Técnicas de autorregulación y planificación ejecutiva",
    therapist: "Carlos Ruiz", nextVisit: "Hoy, 12:00", lastVisit: "29 may 2026",
    totalVisits: 11, startDate: "20 ene 2026", color: "#2a6b3f",
  },
  {
    id: "p6", name: "Manuel Sánchez Ruiz", age: 76, specialty: "T. Ocupacional", status: "Activo",
    phone: "677 890 123", address: "Calle Leyre 28, 3ºB — Pamplona",
    diagnosis: "Enfermedad de Parkinson — estadio II",
    objective: "Adaptación del entorno y mantenimiento de habilidades motoras finas",
    therapist: "Laura Vega", nextVisit: "07 jun 2026", lastVisit: "31 may 2026",
    totalVisits: 18, startDate: "14 nov 2025", color: "#1a5c80",
  },
];

const visitsByPatient: Record<string, Visit[]> = {
  p1: [
    {
      id: "v1", patientId: "p1", date: "03 jun 2026", time: "10:30", duration: 45,
      notes: "Mejora significativa en la flexión de cadera. Alcanza 85° de flexión activa. Se trabajan ejercicios de fortalecimiento de glúteo medio y cuádriceps. Paciente muy motivada y colaboradora en los ejercicios.",
      interventions: ["Ejercicios activos asistidos", "Electroterapia TENS", "Masaje cicatriz quirúrgica"],
      score: 7,
    },
    {
      id: "v2", patientId: "p1", date: "27 may 2026", time: "10:30", duration: 45,
      notes: "Flexión de cadera 75°. Dolor EVA 4/10 en movilización. Se introduce marcha sin andador en interiores con supervisión. Buen equilibrio estático.",
      interventions: ["Ejercicios activos asistidos", "Reeducación de marcha", "Crioterapia"],
      score: 6,
    },
    {
      id: "v3", patientId: "p1", date: "20 may 2026", time: "10:30", duration: 45,
      notes: "Primera sesión sin apoyo de andador en circuito corto (5 metros). Dolor EVA 5/10. Mejora progresiva de confianza en la marcha.",
      interventions: ["Ejercicios activos", "Reeducación de marcha", "Electroterapia TENS"],
      score: 5,
    },
  ],
  p2: [
    {
      id: "v4", patientId: "p2", date: "02 jun 2026", time: "11:00", duration: 60,
      notes: "Sesión centrada en reestructuración cognitiva de pensamientos catastróficos laborales. El paciente identifica correctamente sus distorsiones. Se practica respiración diafragmática y técnica de grounding.",
      interventions: ["Reestructuración cognitiva", "Respiración diafragmática", "Registro de pensamientos"],
      score: 6,
    },
    {
      id: "v5", patientId: "p2", date: "26 may 2026", time: "11:00", duration: 60,
      notes: "Trabajo sobre creencias nucleares relacionadas con el rendimiento. Se reporta un episodio de ansiedad durante la semana — analizado y contextualizado. Se incorpora técnica STOP.",
      interventions: ["TCC", "Técnica STOP", "Mindfulness breve"],
      score: 5,
    },
  ],
  p3: [
    {
      id: "v6", patientId: "p3", date: "01 jun 2026", time: "16:00", duration: 60,
      notes: "Trabaja preparación del desayuno de forma autónoma con supervisión mínima. Orientada en tiempo y espacio. Usa agenda de memoria sin problemas. Adapta abridores y utensilios con éxito.",
      interventions: ["AVD básicas", "Estimulación cognitiva", "Adaptación de entorno"],
      score: 8,
    },
    {
      id: "v7", patientId: "p3", date: "25 may 2026", time: "16:00", duration: 60,
      notes: "Ejercicios de memoria episódica con fotos familiares. Reorganización del baño con ayudas técnicas (agarradera, asiento de ducha). Familiares reportan mejoría notable en la rutina matutina.",
      interventions: ["Estimulación cognitiva", "Adaptación de entorno", "Educación familiar"],
      score: 7,
    },
  ],
  p4: [
    {
      id: "v8", patientId: "p4", date: "30 may 2026", time: "09:00", duration: 60,
      notes: "Trabajo de coordinación mano-ojo con ejercicios de precisión. Mejora en prono-supinación del antebrazo izquierdo. Marcha con bastón inglés 20 metros sin incidencias.",
      interventions: ["Ejercicios neuromotores", "Facilitación neuromuscular", "Reeducación de marcha"],
      score: 6,
    },
  ],
  p5: [
    {
      id: "v9", patientId: "p5", date: "29 may 2026", time: "12:00", duration: 50,
      notes: "Implementación de sistema de planificación semanal con código de colores. Se trabaja técnica pomodoro adaptada. La paciente refiere mayor sensación de control en la jornada laboral.",
      interventions: ["Entrenamiento en planificación", "Autorregulación emocional", "Técnicas de atención"],
      score: 7,
    },
  ],
  p6: [
    {
      id: "v10", patientId: "p6", date: "31 may 2026", time: "10:00", duration: 60,
      notes: "Evaluación del entorno cocina. Se instalan barras de apoyo y se reorganizan utensilios de uso frecuente. Trabaja control del temblor en actividades de escritura con técnica de peso en muñeca.",
      interventions: ["Adaptación del entorno", "Control motor fino", "Ayudas técnicas"],
      score: 6,
    },
  ],
};

const progressData: Record<string, ProgressPoint[]> = {
  p1: [
    { mes: "Feb", dolor: 9, funcional: 2 }, { mes: "Mar", dolor: 7, funcional: 4 },
    { mes: "Abr", dolor: 5, funcional: 6 }, { mes: "May", dolor: 4, funcional: 7 },
    { mes: "Jun", dolor: 2, funcional: 8 },
  ],
  p2: [
    { mes: "Mar", animo: 3, funcional: 4 }, { mes: "Abr", animo: 4, funcional: 5 },
    { mes: "May", animo: 5, funcional: 6 }, { mes: "Jun", animo: 6, funcional: 7 },
  ],
  p3: [
    { mes: "Oct", autonomia: 5, funcional: 5 }, { mes: "Dic", autonomia: 6, funcional: 6 },
    { mes: "Feb", autonomia: 6, funcional: 7 }, { mes: "Abr", autonomia: 7, funcional: 7 },
    { mes: "Jun", autonomia: 8, funcional: 8 },
  ],
  p4: [
    { mes: "Sep", funcional: 2 }, { mes: "Nov", funcional: 3 },
    { mes: "Ene", funcional: 4 }, { mes: "Mar", funcional: 5 }, { mes: "May", funcional: 6 },
  ],
  p5: [
    { mes: "Ene", animo: 4, funcional: 4 }, { mes: "Feb", animo: 5, funcional: 5 },
    { mes: "Mar", animo: 5, funcional: 6 }, { mes: "Abr", animo: 6, funcional: 6 },
    { mes: "May", animo: 7, funcional: 7 },
  ],
  p6: [
    { mes: "Nov", funcional: 4, autonomia: 5 }, { mes: "Ene", funcional: 5, autonomia: 5 },
    { mes: "Mar", funcional: 5, autonomia: 6 }, { mes: "May", funcional: 6, autonomia: 6 },
  ],
};

const initialProfessionals: Professional[] = [
  {
    id: "admin", name: "Administrador", role: "Administrador",
    numColegiado: "—", phone: "—",
    email: "admin@domusges.es", active: true, color: "#1c2d32", joined: "ene 2024",
    password: "admin2026", isAdmin: true,
  },
  {
    id: "prof1", name: "Ana Moreno", role: "Fisioterapeuta",
    numColegiado: "28-FT-4521", phone: "611 222 333",
    email: "ana.moreno@domusges.es", active: true, color: "#1a5c58", joined: "mar 2024",
    password: "domus2026",
  },
  {
    id: "prof2", name: "Carlos Ruiz", role: "Psicólogo/a Clínico/a",
    numColegiado: "28-PS-7832", phone: "622 333 444",
    email: "carlos.ruiz@domusges.es", active: true, color: "#5b3fa0", joined: "jun 2024",
    password: "domus2026",
  },
  {
    id: "prof3", name: "Laura Vega", role: "Terapeuta Ocupacional",
    numColegiado: "28-TO-1947", phone: "633 444 555",
    email: "laura.vega@domusges.es", active: true, color: "#c17f3a", joined: "sep 2023",
    password: "domus2026",
  },
];

const DEMO_PASSWORD = "domus2026";

// ─── Login ────────────────────────────────────────────────────────────────────

function ForgotPasswordView({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "#f4f7f6" }}>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: "#e3eeec" }}>
              <KeyRound size={18} style={{ color: "#1a5c58" }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ fontFamily: "'Fraunces', serif", color: "#1c2d32" }}>
                Recuperar contraseña
              </h2>
              <p className="text-xs" style={{ color: "#6b7c80" }}>Te enviaremos un enlace de acceso</p>
            </div>
          </div>

          {sent ? (
            <div className="text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center"
                style={{ backgroundColor: "#e3eeec" }}>
                <CheckCircle2 size={24} style={{ color: "#1a5c58" }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: "#1c2d32" }}>Enlace enviado</p>
              <p className="text-xs leading-relaxed" style={{ color: "#6b7c80" }}>
                Hemos enviado un enlace de recuperación a <strong>{email}</strong>.<br />
                Revisa tu bandeja de entrada.
              </p>
              <button onClick={onBack}
                className="mt-4 text-xs font-medium underline underline-offset-2"
                style={{ color: "#1a5c58" }}>
                Volver al inicio de sesión
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "#6b7c80" }}>
                  Correo electrónico
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu.nombre@domusges.es"
                  className="w-full px-3 py-2.5 rounded-lg text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ color: "#1c2d32" }}
                />
              </div>
              <button
                onClick={() => { if (email) setSent(true); }}
                disabled={!email}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ backgroundColor: "#1a5c58" }}>
                Enviar enlace de recuperación
                <ArrowRight size={15} />
              </button>
              <button onClick={onBack}
                className="w-full text-xs font-medium text-center"
                style={{ color: "#6b7c80" }}>
                ← Volver al inicio de sesión
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LoginView({ professionals, onLogin }: {
  professionals: Professional[];
  onLogin: (profId: string) => void;
}) {
  const [screen, setScreen] = useState<"login" | "forgot">("login");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  function handleLogin() {
    if (!selectedId) return;
    const prof = professionals.find((p) => p.id === selectedId);
    const correct = prof?.password ?? DEMO_PASSWORD;
    if (password === correct) {
      onLogin(selectedId);
    } else {
      setError("Contraseña incorrecta");
    }
  }

  if (screen === "forgot") {
    return <ForgotPasswordView onBack={() => setScreen("login")} />;
  }

  const selected = professionals.find((p) => p.id === selectedId);

  const ROLE_SHORT: Record<string, string> = {
    "Fisioterapeuta": "Fisioterapia",
    "Psicólogo/a Clínico/a": "Psicología",
    "Terapeuta Ocupacional": "T. Ocupacional",
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: "#f4f7f6" }}>
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[420px] flex-shrink-0 flex-col justify-between p-10"
        style={{ backgroundColor: "#1a5c58" }}>
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <Home size={18} className="text-white" />
            </div>
            <span className="text-white font-semibold text-lg" style={{ fontFamily: "'Fraunces', serif" }}>
              DomusGes
            </span>
          </div>
          <div>
            <h1 className="text-3xl font-semibold text-white leading-snug mb-4"
              style={{ fontFamily: "'Fraunces', serif" }}>
              Gestión de pacientes de<br />atención domiciliaria
            </h1>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
              Aplicación diseñada para perfiles de Terapia Ocupacional, Fisioterapia, Psicología y disciplinas afines. Coordina el seguimiento clínico, visualiza rutas diarias y registra valoraciones desde un único lugar.
            </p>
          </div>
        </div>
        {/* Stats strip */}
        <div className="space-y-3">
          {[
            { label: "Pacientes activos", value: "6" },
            { label: "Visitas esta semana", value: "12" },
            { label: "Profesionales", value: "3" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-3 border-t"
              style={{ borderColor: "rgba(255,255,255,0.15)" }}>
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{label}</span>
              <span className="text-sm font-semibold text-white" style={{ fontFamily: "'DM Mono', monospace" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 lg:hidden mb-8">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#1a5c58" }}>
              <Home size={16} className="text-white" />
            </div>
            <span className="font-semibold text-lg" style={{ fontFamily: "'Fraunces', serif", color: "#1c2d32" }}>
              DomusGes
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-1" style={{ fontFamily: "'Fraunces', serif", color: "#1c2d32" }}>
              Bienvenido de nuevo
            </h2>
            <p className="text-sm" style={{ color: "#6b7c80" }}>Selecciona tu perfil para continuar</p>
          </div>

          {/* Professional selector */}
          <div className="space-y-2">
            {professionals.filter((p) => p.active).map((prof) => {
              const isSelected = selectedId === prof.id;
              return (
                <button
                  key={prof.id}
                  onClick={() => { setSelectedId(prof.id); setPassword(""); setError(""); }}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left"
                  style={{
                    borderColor: isSelected ? prof.color : "rgba(28,45,50,0.12)",
                    backgroundColor: isSelected ? `${prof.color}0d` : "#fff",
                    boxShadow: isSelected ? `0 0 0 2px ${prof.color}30` : "none",
                  }}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
                    style={{ backgroundColor: prof.color }}>
                    {getInitials(prof.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold" style={{ color: "#1c2d32" }}>{prof.name}</p>
                      {prof.isAdmin && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ backgroundColor: "#f0f0f0", color: "#6b7c80" }}>Admin</span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: "#6b7c80" }}>{ROLE_SHORT[prof.role] ?? prof.role}</p>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: prof.color }}>
                      <CheckCircle2 size={12} className="text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Password field — appears after selecting */}
          {selectedId && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "#6b7c80" }}>
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-primary/30"
                    style={{
                      borderColor: error ? "#c0392b" : "rgba(28,45,50,0.12)",
                      color: "#1c2d32",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: "#6b7c80" }}
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {error && <p className="text-xs mt-1" style={{ color: "#c0392b" }}>{error}</p>}
                <p className="text-xs mt-1.5" style={{ color: "#9ab0ad" }}>
                  Demo: <span style={{ fontFamily: "'DM Mono', monospace" }}>
                    {professionals.find((p) => p.id === selectedId)?.password ?? DEMO_PASSWORD}
                  </span>
                </p>
              </div>

              <button
                onClick={handleLogin}
                disabled={!password}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 flex items-center justify-center gap-2 transition-opacity"
                style={{ backgroundColor: selected?.color ?? "#1a5c58" }}
              >
                Entrar como {selected?.name.split(" ")[0]}
                <ArrowRight size={15} />
              </button>
            </div>
          )}

          <button
            onClick={() => setScreen("forgot")}
            className="text-xs font-medium block w-full text-center"
            style={{ color: "#6b7c80" }}>
            ¿Olvidaste tu contraseña?
          </button>
        </div>
      </div>
    </div>
  );
}

const AVATAR_COLORS = [
  "#1a5c58", "#5b3fa0", "#c17f3a", "#b03060",
  "#2a6b3f", "#1a5c80", "#7c3a5c", "#3a6b5c",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function specialtyStyle(s: Specialty) {
  if (s === "Fisioterapia") return { bg: "#e3eeec", text: "#1a5c58", dot: "#1a5c58" };
  if (s === "Psicología") return { bg: "#ede8f7", text: "#5b3fa0", dot: "#5b3fa0" };
  return { bg: "#fdf0e3", text: "#a0621a", dot: "#c17f3a" };
}

function statusStyle(s: Status) {
  if (s === "Activo") return { bg: "#e6f4ea", text: "#256d35" };
  if (s === "En seguimiento") return { bg: "#e8f0fe", text: "#1a5c9e" };
  if (s === "Alta") return { bg: "#f0f0f0", text: "#555" };
  return { bg: "#fde8e8", text: "#b91c1c" };
}

// ─── Small Components ─────────────────────────────────────────────────────────

function Avatar({ name, color, size = "md" }: { name: string; color: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-lg" };
  return (
    <div
      className={`${sizes[size]} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0`}
      style={{ backgroundColor: color }}
    >
      {getInitials(name)}
    </div>
  );
}

function SpecialtyBadge({ specialty }: { specialty: Specialty }) {
  const st = specialtyStyle(specialty);
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: st.bg, color: st.text }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: st.dot }} />
      {specialty}
    </span>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const st = statusStyle(status);
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: st.bg, color: st.text }}>
      {status}
    </span>
  );
}

function ScoreDots({ score }: { score: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: i < score ? "#1a5c58" : "#e9e5de" }}
        />
      ))}
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const navItems = [
  { id: "dashboard", label: "Inicio", icon: LayoutDashboard },
  { id: "today", label: "Hoy", icon: Navigation2 },
  { id: "patients", label: "Pacientes", icon: Users },
  { id: "equipo", label: "Equipo", icon: Users2 },
  { id: "calendar", label: "Agenda", icon: CalendarDays },
  { id: "reports", label: "Informes", icon: FileText },
  { id: "facturacion", label: "Facturación", icon: Receipt },
];

function Sidebar({
  active, onNavigate, open, onClose, loggedInProf,
}: {
  active: View; onNavigate: (v: View) => void; open: boolean; onClose: () => void;
  loggedInProf?: Professional;
}) {
  const isAdmin = loggedInProf?.isAdmin ?? false;

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed top-0 left-0 h-full z-30 flex flex-col transition-transform duration-300
          lg:translate-x-0 lg:relative lg:z-auto
          ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ width: 252, backgroundColor: "#0a3330", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
      >
        <div className="flex items-center justify-between px-5 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#1a5c58" }}>
              <Home size={16} color="white" />
            </div>
            <div>
              <div className="text-white font-semibold text-sm tracking-wide leading-tight">DomusGes</div>
              <div className="text-xs leading-tight" style={{ color: "rgba(255,255,255,0.45)", fontFamily: "'Didact Gothic', sans-serif" }}>
                Salud Domiciliaria
              </div>
            </div>
          </div>
          <button className="lg:hidden p-1 rounded" onClick={onClose} style={{ color: "rgba(255,255,255,0.6)" }}>
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {/* Admin sees only Usuarios management nav */}
          {isAdmin ? (
            <button
              onClick={() => { onNavigate("admin-users"); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
              style={{
                backgroundColor: active === "admin-users" ? "rgba(255,255,255,0.12)" : "transparent",
                color: active === "admin-users" ? "#ffffff" : "rgba(255,255,255,0.65)",
                fontWeight: active === "admin-users" ? 600 : 400,
              }}
            >
              <UserPlus size={17} />
              Gestión de usuarios
            </button>
          ) : (
            navItems.map(({ id, label, icon: Icon }) => {
              const isActive = active === id;
              return (
                <button
                  key={id}
                  onClick={() => { onNavigate(id as View); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
                  style={{
                    backgroundColor: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                    color: isActive ? "#ffffff" : "rgba(255,255,255,0.65)",
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  <Icon size={17} />
                  {label}
                </button>
              );
            })
          )}
        </nav>

        <div className="px-3 pb-5 space-y-0.5">
          <button
            onClick={() => { onNavigate("settings"); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
            style={{
              backgroundColor: active === "settings" ? "rgba(255,255,255,0.12)" : "transparent",
              color: active === "settings" ? "#ffffff" : "rgba(255,255,255,0.55)",
              fontWeight: active === "settings" ? 600 : 400,
            }}
          >
            <Settings size={17} />
            Configuración
          </button>
          <div className="mt-3 px-3 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            {loggedInProf ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                  style={{ backgroundColor: loggedInProf.color }}>
                  {getInitials(loggedInProf.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-white truncate">{loggedInProf.name}</div>
                  <div className="text-xs truncate" style={{ color: "rgba(255,255,255,0.45)" }}>
                    {loggedInProf.isAdmin ? "Administrador" : loggedInProf.role}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                  style={{ backgroundColor: "#444" }}>?</div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ onSelectPatient, onNewVisit }: {
  onSelectPatient: (id: string) => void; onNewVisit: () => void;
}) {
  const todayVisits = [
    { patientId: "p1", time: "10:30", done: true },
    { patientId: "p5", time: "12:00", done: false },
    { patientId: "p3", time: "16:00", done: false },
  ];

  const stats = [
    { label: "Pacientes activos", value: 5, icon: Users, color: "#1a5c58", bg: "#e3eeec" },
    { label: "Visitas hoy", value: 3, icon: CalendarDays, color: "#c17f3a", bg: "#fdf0e3" },
    { label: "Pendientes esta semana", value: 8, icon: ClipboardList, color: "#5b3fa0", bg: "#ede8f7" },
    { label: "Altas este mes", value: 1, icon: TrendingUp, color: "#2a6b3f", bg: "#e6f4ea" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "'Didact Gothic', sans-serif", color: "#1c2d32" }}>Buenos días, Sara</h1>
          <p className="text-sm mt-0.5" style={{ color: "#6b7c80" }}>
            Jueves 5 de junio · 3 visitas programadas hoy
          </p>
        </div>
        <button
          onClick={onNewVisit}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#1a5c58" }}
        >
          <Plus size={15} />
          Nueva visita
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm" style={{ color: "#6b7c80" }}>{label}</p>
                <p className="text-3xl font-semibold mt-1" style={{ fontFamily: "'Fraunces', serif", color: "#1c2d32" }}>
                  {value}
                </p>
              </div>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: bg }}>
                <Icon size={17} style={{ color }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Today's visits */}
        <div className="lg:col-span-3 bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(28,45,50,0.08)" }}>
            <h2 className="font-semibold text-sm" style={{ color: "#1c2d32" }}>Visitas de hoy</h2>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: "#e3eeec", color: "#1a5c58" }}>
              Jue 5 jun
            </span>
          </div>
          <div className="divide-y divide-border">
            {todayVisits.map(({ patientId, time, done }) => {
              const p = patients.find((x) => x.id === patientId)!;
              return (
                <button
                  key={patientId}
                  onClick={() => onSelectPatient(patientId)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors text-left"
                >
                  <div className="flex items-center gap-1 w-14 flex-shrink-0">
                    {done
                      ? <CheckCircle2 size={14} style={{ color: "#2a6b3f" }} />
                      : <AlertCircle size={14} style={{ color: "#c17f3a" }} />
                    }
                    <span className="text-xs font-medium" style={{ fontFamily: "'DM Mono', monospace", color: "#6b7c80" }}>
                      {time}
                    </span>
                  </div>
                  <Avatar name={p.name} color={p.color} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#1c2d32" }}>{p.name}</p>
                    <p className="text-xs truncate" style={{ color: "#6b7c80" }}>{p.diagnosis}</p>
                  </div>
                  <SpecialtyBadge specialty={p.specialty} />
                  <ChevronRight size={14} style={{ color: "#b0bec5" }} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Recent patients */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: "1px solid rgba(28,45,50,0.08)" }}>
            <h2 className="font-semibold text-sm" style={{ color: "#1c2d32" }}>Últimas actualizaciones</h2>
          </div>
          <div className="divide-y divide-border">
            {patients.slice(0, 4).map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectPatient(p.id)}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-muted/40 transition-colors text-left"
              >
                <Avatar name={p.name} color={p.color} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "#1c2d32" }}>{p.name}</p>
                  <p className="text-xs" style={{ color: "#6b7c80", fontFamily: "'DM Mono', monospace" }}>
                    {p.lastVisit}
                  </p>
                </div>
                <StatusBadge status={p.status} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Patient List ─────────────────────────────────────────────────────────────

function PatientList({ patients, onSelectPatient, onNewVisit, onNewPatient }: {
  patients: Patient[]; onSelectPatient: (id: string) => void;
  onNewVisit: () => void; onNewPatient: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | Specialty>("all");

  const filtered = patients.filter((p) => {
    const matchQuery = p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.diagnosis.toLowerCase().includes(query.toLowerCase());
    const matchFilter = filter === "all" || p.specialty === filter;
    return matchQuery && matchFilter;
  });

  const filters: Array<{ key: "all" | Specialty; label: string }> = [
    { key: "all", label: "Todos" },
    { key: "Fisioterapia", label: "Fisioterapia" },
    { key: "Psicología", label: "Psicología" },
    { key: "T. Ocupacional", label: "T. Ocupacional" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "'Fraunces', serif", color: "#1c2d32" }}>
            Pacientes
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#6b7c80" }}>{patients.length} pacientes registrados</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            onClick={onNewVisit}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-border transition-colors hover:bg-muted/40"
            style={{ color: "#1c2d32" }}
          >
            <Plus size={15} />
            Nueva visita
          </button>
          <button
            onClick={onNewPatient}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#1a5c58" }}
          >
            <UserPlus size={15} />
            Nuevo paciente
          </button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "#6b7c80" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre o diagnóstico…"
            className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm border border-border bg-card outline-none focus:ring-2 focus:ring-primary/30"
            style={{ color: "#1c2d32" }}
          />
        </div>
        <div className="flex gap-2">
          {filters.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="px-3 py-2 rounded-lg text-xs font-medium transition-all"
              style={filter === key
                ? { backgroundColor: "#1a5c58", color: "#fff" }
                : { backgroundColor: "#fff", color: "#6b7c80", border: "1px solid rgba(28,45,50,0.1)" }
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="hidden sm:grid text-xs font-medium px-5 py-3 gap-4"
          style={{
            gridTemplateColumns: "2fr 1fr 1.2fr 1fr 0.8fr 0.8fr 32px",
            color: "#6b7c80",
            borderBottom: "1px solid rgba(28,45,50,0.08)",
            backgroundColor: "#faf9f7",
          }}
        >
          <span>Paciente</span>
          <span>Especialidad</span>
          <span>Diagnóstico</span>
          <span>Terapeuta</span>
          <span>Próxima visita</span>
          <span>Estado</span>
          <span />
        </div>
        <div className="divide-y divide-border">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelectPatient(p.id)}
              className="w-full hover:bg-muted/30 transition-colors text-left"
            >
              {/* Mobile layout */}
              <div className="sm:hidden flex items-center gap-3 px-5 py-4">
                <Avatar name={p.name} color={p.color} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "#1c2d32" }}>{p.name}</p>
                  <p className="text-xs truncate" style={{ color: "#6b7c80" }}>{p.diagnosis}</p>
                  <div className="flex gap-2 mt-1">
                    <SpecialtyBadge specialty={p.specialty} />
                    <StatusBadge status={p.status} />
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: "#b0bec5" }} />
              </div>
              {/* Desktop layout */}
              <div className="hidden sm:grid items-center px-5 py-3.5 gap-4"
                style={{ gridTemplateColumns: "2fr 1fr 1.2fr 1fr 0.8fr 0.8fr 32px" }}>
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar name={p.name} color={p.color} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#1c2d32" }}>{p.name}</p>
                    <p className="text-xs" style={{ color: "#6b7c80" }}>{p.age} años</p>
                  </div>
                </div>
                <SpecialtyBadge specialty={p.specialty} />
                <p className="text-xs truncate" style={{ color: "#6b7c80" }}>{p.diagnosis}</p>
                <p className="text-xs" style={{ color: "#6b7c80" }}>{p.therapist}</p>
                <p className="text-xs font-medium" style={{ color: "#1c2d32", fontFamily: "'DM Mono', monospace" }}>
                  {p.nextVisit}
                </p>
                <StatusBadge status={p.status} />
                <ChevronRight size={14} style={{ color: "#b0bec5" }} />
              </div>
            </button>
          ))}
        </div>
        {filtered.length === 0 && (
          <div className="text-center py-16" style={{ color: "#6b7c80" }}>
            <User size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No se encontraron pacientes</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Assessment & Report types ───────────────────────────────────────────────

interface Assessment {
  id: string;
  patientId: string;
  date: string;
  scale: string;
  category: string;
  score: string;
  observer: string;
  type?: string;
  notes?: string;
}

interface PatientReport {
  id: string;
  patientId: string;
  date: string;
  type: string;
  author: string;
  summary?: string;
}

const SCALES_BY_SPECIALTY: Record<Specialty, Array<{ name: string; category: string; range: string }>> = {
  "Fisioterapia": [
    { name: "Índice de Barthel", category: "Funcionalidad", range: "0–100" },
    { name: "Escala Visual Analógica (EVA)", category: "Dolor", range: "0–10" },
    { name: "Berg Balance Scale", category: "Equilibrio", range: "0–56" },
    { name: "Test de Tinetti", category: "Marcha y equilibrio", range: "0–28" },
    { name: "Timed Up and Go (TUG)", category: "Movilidad", range: "segundos" },
    { name: "Escala de Rankin Modificada", category: "Discapacidad", range: "0–6" },
  ],
  "Psicología": [
    { name: "PHQ-9", category: "Depresión", range: "0–27" },
    { name: "GAD-7", category: "Ansiedad", range: "0–21" },
    { name: "Escala de Hamilton (HAMA)", category: "Ansiedad", range: "0–56" },
    { name: "BDI-II (Beck)", category: "Depresión", range: "0–63" },
    { name: "Índice de Pittsburgh (PSQI)", category: "Sueño", range: "0–21" },
    { name: "Escala de Estrés Percibido (PSS)", category: "Estrés", range: "0–40" },
  ],
  "T. Ocupacional": [
    { name: "Índice de Barthel", category: "AVD Básicas", range: "0–100" },
    { name: "Escala de Lawton y Brody", category: "AVD Instrumentales", range: "0–8" },
    { name: "MMSE (Mini-Mental)", category: "Cognitivo", range: "0–30" },
    { name: "Test del Reloj", category: "Cognitivo", range: "0–10" },
    { name: "GDS (Reisberg)", category: "Deterioro cognitivo", range: "1–7" },
    { name: "FIM (Medida de Independencia)", category: "Funcionalidad", range: "18–126" },
  ],
};

const seedAssessments: Assessment[] = [
  { id: "ev1",  patientId: "p1", date: "05 may 2026", scale: "Índice de Barthel", category: "Funcionalidad", score: "75", observer: "Ana Moreno", notes: "Dependencia moderada. Mejora respecto a valoración inicial." },
  { id: "ev2",  patientId: "p1", date: "05 may 2026", scale: "Escala Visual Analógica (EVA)", category: "Dolor", score: "4", observer: "Ana Moreno" },
  { id: "ev3",  patientId: "p1", date: "05 may 2026", scale: "Berg Balance Scale", category: "Equilibrio", score: "42", observer: "Ana Moreno", notes: "Riesgo moderado de caída." },
  { id: "ev4",  patientId: "p1", date: "12 feb 2026", scale: "Índice de Barthel", category: "Funcionalidad", score: "45", observer: "Ana Moreno", notes: "Valoración inicial post-quirúrgica." },
  { id: "ev5",  patientId: "p1", date: "12 feb 2026", scale: "Escala Visual Analógica (EVA)", category: "Dolor", score: "8", observer: "Ana Moreno" },
  { id: "ev6",  patientId: "p2", date: "10 may 2026", scale: "PHQ-9", category: "Depresión", score: "12", observer: "Carlos Ruiz", notes: "Depresión moderada. Seguimiento quincenal." },
  { id: "ev7",  patientId: "p2", date: "10 may 2026", scale: "GAD-7", category: "Ansiedad", score: "10", observer: "Carlos Ruiz", notes: "Ansiedad moderada relacionada con el entorno laboral." },
  { id: "ev8",  patientId: "p2", date: "15 mar 2026", scale: "PHQ-9", category: "Depresión", score: "17", observer: "Carlos Ruiz", notes: "Valoración inicial. Depresión moderada-severa." },
  { id: "ev9",  patientId: "p2", date: "15 mar 2026", scale: "GAD-7", category: "Ansiedad", score: "14", observer: "Carlos Ruiz", notes: "Ansiedad severa en evaluación inicial." },
  { id: "ev10", patientId: "p3", date: "01 may 2026", scale: "Índice de Barthel", category: "AVD Básicas", score: "65", observer: "Laura Vega", notes: "Dependencia moderada. Necesita supervisión en aseo." },
  { id: "ev11", patientId: "p3", date: "01 may 2026", scale: "Escala de Lawton y Brody", category: "AVD Instrumentales", score: "4/8", observer: "Laura Vega" },
  { id: "ev12", patientId: "p3", date: "01 may 2026", scale: "MMSE (Mini-Mental)", category: "Cognitivo", score: "24", observer: "Laura Vega", notes: "DCL confirmado. Orientación temporal parcialmente preservada." },
  { id: "ev13", patientId: "p3", date: "05 oct 2025", scale: "Índice de Barthel", category: "AVD Básicas", score: "70", observer: "Laura Vega", notes: "Valoración inicial." },
  { id: "ev14", patientId: "p3", date: "05 oct 2025", scale: "MMSE (Mini-Mental)", category: "Cognitivo", score: "26", observer: "Laura Vega", notes: "Valoración inicial." },
  { id: "ev15", patientId: "p4", date: "20 may 2026", scale: "Índice de Barthel", category: "Funcionalidad", score: "60", observer: "Ana Moreno", notes: "Mejora progresiva desde inicio del tratamiento." },
  { id: "ev16", patientId: "p4", date: "20 may 2026", scale: "Escala Visual Analógica (EVA)", category: "Dolor", score: "3", observer: "Ana Moreno" },
  { id: "ev17", patientId: "p4", date: "18 sep 2025", scale: "Índice de Barthel", category: "Funcionalidad", score: "30", observer: "Ana Moreno", notes: "Valoración inicial post-ictus." },
  { id: "ev18", patientId: "p5", date: "15 may 2026", scale: "PHQ-9", category: "Depresión", score: "8", observer: "Carlos Ruiz", notes: "Mejoría notable respecto a valoración inicial." },
  { id: "ev19", patientId: "p5", date: "15 may 2026", scale: "GAD-7", category: "Ansiedad", score: "11", observer: "Carlos Ruiz" },
  { id: "ev20", patientId: "p5", date: "20 ene 2026", scale: "PHQ-9", category: "Depresión", score: "13", observer: "Carlos Ruiz", notes: "Valoración inicial." },
  { id: "ev21", patientId: "p5", date: "20 ene 2026", scale: "GAD-7", category: "Ansiedad", score: "15", observer: "Carlos Ruiz", notes: "Valoración inicial." },
  { id: "ev22", patientId: "p6", date: "15 may 2026", scale: "Índice de Barthel", category: "AVD Básicas", score: "70", observer: "Laura Vega" },
  { id: "ev23", patientId: "p6", date: "15 may 2026", scale: "MMSE (Mini-Mental)", category: "Cognitivo", score: "26", observer: "Laura Vega", notes: "Función cognitiva conservada." },
  { id: "ev24", patientId: "p6", date: "14 nov 2025", scale: "Índice de Barthel", category: "AVD Básicas", score: "75", observer: "Laura Vega", notes: "Valoración inicial. Estadio II Parkinson." },
  { id: "ev25", patientId: "p6", date: "14 nov 2025", scale: "Escala de Lawton y Brody", category: "AVD Instrumentales", score: "5/8", observer: "Laura Vega" },
];

const seedReports: PatientReport[] = [
  { id: "r1", patientId: "p1", date: "15 abr 2026", type: "Informe de evolución", author: "Ana Moreno", summary: "Evolución favorable tras 2 meses. Recuperación de movilidad al 70%." },
  { id: "r2", patientId: "p3", date: "01 abr 2026", type: "Informe de evolución", author: "Laura Vega", summary: "Mantenimiento de AVD con supervisión mínima. Adaptación del entorno completada." },
  { id: "r3", patientId: "p4", date: "20 mar 2026", type: "Informe de evolución", author: "Ana Moreno", summary: "Progreso neuromotor significativo. Marcha independiente con bastón en distancias cortas." },
  { id: "r4", patientId: "p2", date: "05 may 2026", type: "Informe de evolución", author: "Carlos Ruiz", summary: "Reducción de síntomas ansiosos. Adherencia al tratamiento correcta." },
];

// ─── Patient Detail ───────────────────────────────────────────────────────────

type DetailTab = "resumen" | "visitas" | "valoraciones" | "informes" | "evolucion";

function PatientDetail({ patientId, patients, visits, assessments, onAddAssessment, onBack, onNewVisit }: {
  patientId: string; patients: Patient[]; visits: Visit[]; assessments: Assessment[];
  onAddAssessment: (a: Assessment) => void; onBack: () => void; onNewVisit: (id: string) => void;
}) {
  const [tab, setTab] = useState<DetailTab>("resumen");
  const [showAsvForm, setShowAsvForm] = useState(false);
  const [asvForm, setAsvForm] = useState({ date: "2026-06-05", scale: "", score: "", notes: "", type: "Nueva valoración" });
  const [expandedScale, setExpandedScale] = useState<string | null>(null);
  const patient = patients.find((p) => p.id === patientId)!;
  const progress = progressData[patientId] ?? [];

  const scaleOptions = SCALES_BY_SPECIALTY[patient.specialty] ?? [];
  const selectedScale = scaleOptions.find((s) => s.name === asvForm.scale);

  function handleSaveAssessment() {
    if (!asvForm.scale || !asvForm.score) return;
    const dateObj = new Date(asvForm.date + "T00:00");
    const a: Assessment = {
      id: `ev${Date.now()}`,
      patientId,
      date: format(dateObj, "dd MMM yyyy", { locale: es }),
      scale: asvForm.scale,
      category: selectedScale?.category ?? "",
      score: asvForm.score,
      observer: patient.therapist,
      type: asvForm.type,
      notes: asvForm.notes || undefined,
    };
    onAddAssessment(a);
    setAsvForm({ date: "2026-06-05", scale: "", score: "", notes: "", type: "Nueva valoración" });
    setShowAsvForm(false);
  }

  const groupedAssessments = assessments.reduce<Record<string, Assessment[]>>((acc, a) => {
    if (!acc[a.scale]) acc[a.scale] = [];
    acc[a.scale].push(a);
    return acc;
  }, {});

  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "resumen", label: "Resumen" },
    { id: "visitas", label: "Historial de visitas" },
    { id: "valoraciones", label: "Valoraciones" },
    { id: "informes", label: "Informes" },
    { id: "evolucion", label: "Evolución" },
  ];

  const progressKeys = Object.keys(progress[0] ?? {}).filter((k) => k !== "mes");
  const keyLabels: Record<string, string> = {
    dolor: "Dolor (EVA)",
    funcional: "Funcionalidad",
    animo: "Estado anímico",
    autonomia: "Autonomía",
  };
  const keyColors: Record<string, string> = {
    dolor: "#b03060",
    funcional: "#1a5c58",
    animo: "#5b3fa0",
    autonomia: "#c17f3a",
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
        style={{ color: "#6b7c80" }}>
        <ArrowLeft size={15} />
        Volver
      </button>

      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <Avatar name={patient.name} color={patient.color} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-semibold" style={{ fontFamily: "'Fraunces', serif", color: "#1c2d32" }}>
                {patient.name}
              </h1>
              <StatusBadge status={patient.status} />
            </div>
            <p className="text-sm mb-3" style={{ color: "#6b7c80" }}>{patient.age} años · {patient.diagnosis}</p>
            <div className="flex flex-wrap gap-2">
              <SpecialtyBadge specialty={patient.specialty} />
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: "#f0f0f0", color: "#555" }}>
                <User size={11} />
                {patient.therapist}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full"
                style={{ backgroundColor: "#f0f0f0", color: "#555" }}>
                <Activity size={11} />
                {patient.totalVisits} visitas
              </span>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <a href={`tel:${patient.phone}`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-border transition-colors hover:bg-muted/50"
              style={{ color: "#1c2d32" }}>
              <Phone size={13} />
              Llamar
            </a>
            <button
              onClick={() => onNewVisit(patientId)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: "#1a5c58" }}
            >
              <Plus size={13} />
              Registrar visita
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ backgroundColor: "rgba(28,45,50,0.07)" }}>
        {tabs.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className="px-4 py-2 rounded-lg text-xs font-medium transition-all"
            style={tab === id
              ? { backgroundColor: "#fff", color: "#1c2d32", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }
              : { color: "#6b7c80" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "resumen" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-sm font-semibold" style={{ color: "#1c2d32" }}>Datos de contacto</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Phone size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#6b7c80" }} />
                <div>
                  <p className="text-xs" style={{ color: "#6b7c80" }}>Teléfono</p>
                  <p className="text-sm font-medium" style={{ color: "#1c2d32" }}>{patient.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#6b7c80" }} />
                <div>
                  <p className="text-xs" style={{ color: "#6b7c80" }}>Domicilio</p>
                  <p className="text-sm font-medium" style={{ color: "#1c2d32" }}>{patient.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#6b7c80" }} />
                <div>
                  <p className="text-xs" style={{ color: "#6b7c80" }}>Próxima visita</p>
                  <p className="text-sm font-medium" style={{ color: "#1c2d32" }}>{patient.nextVisit}</p>
                </div>
              </div>
              {patient.referentName && (
                <div className="flex items-start gap-3 pt-2 border-t border-border">
                  <User size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#6b7c80" }} />
                  <div>
                    <p className="text-xs" style={{ color: "#6b7c80" }}>Persona de referencia</p>
                    <p className="text-sm font-medium" style={{ color: "#1c2d32" }}>{patient.referentName}</p>
                    {patient.referentPhone && (
                      <p className="text-xs mt-0.5" style={{ color: "#6b7c80", fontFamily: "'DM Mono', monospace" }}>
                        {patient.referentPhone}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-sm font-semibold" style={{ color: "#1c2d32" }}>Plan terapéutico</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs mb-1" style={{ color: "#6b7c80" }}>Diagnóstico</p>
                <p className="text-sm" style={{ color: "#1c2d32" }}>{patient.diagnosis}</p>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "#6b7c80" }}>Objetivo terapéutico</p>
                <p className="text-sm" style={{ color: "#1c2d32" }}>{patient.objective}</p>
              </div>
              <div className="flex gap-6">
                <div>
                  <p className="text-xs" style={{ color: "#6b7c80" }}>Inicio</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: "#1c2d32", fontFamily: "'DM Mono', monospace" }}>
                    {patient.startDate}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "#6b7c80" }}>Visitas totales</p>
                  <p className="text-xs font-medium mt-0.5" style={{ color: "#1c2d32", fontFamily: "'DM Mono', monospace" }}>
                    {patient.totalVisits}
                  </p>
                </div>
              </div>
            </div>
          </div>
          {visits[0] && (
            <div className="sm:col-span-2 bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold mb-3" style={{ color: "#1c2d32" }}>Última visita — {visits[0].date}</h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "#6b7c80" }}>{visits[0].notes}</p>
              <div className="flex flex-wrap gap-2">
                {visits[0].interventions.map((i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-lg"
                    style={{ backgroundColor: "#e3eeec", color: "#1a5c58" }}>{i}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "visitas" && (
        <div className="space-y-3">
          {visits.length === 0 && (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <ClipboardList size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm" style={{ color: "#6b7c80" }}>Sin visitas registradas</p>
            </div>
          )}
          {visits.map((v) => (
            <div key={v.id} className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#1c2d32" }}>{v.date}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#6b7c80", fontFamily: "'DM Mono', monospace" }}>
                    {v.time} · {v.duration} min
                  </p>
                </div>
                {v.score > 0 && (
                  <div className="text-right">
                    <p className="text-xs mb-1" style={{ color: "#6b7c80" }}>Puntuación</p>
                    <ScoreDots score={v.score} />
                  </div>
                )}
              </div>
              <p className="text-sm leading-relaxed mb-3" style={{ color: "#6b7c80" }}>{v.notes}</p>
              <div className="flex flex-wrap gap-2">
                {v.interventions.map((i) => (
                  <span key={i} className="text-xs px-2.5 py-1 rounded-lg"
                    style={{ backgroundColor: "#e3eeec", color: "#1a5c58" }}>{i}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "valoraciones" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "#1c2d32" }}>Escalas de valoración clínica</h3>
              <p className="text-xs mt-0.5" style={{ color: "#6b7c80" }}>Instrumentos estandarizados para {patient.specialty}</p>
            </div>
            <button
              onClick={() => setShowAsvForm((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: "#1a5c58" }}
            >
              <Plus size={13} />
              Nueva valoración
            </button>
          </div>

          {showAsvForm && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#6b7c80" }}>Añadir valoración</h4>

              {/* Tipo de valoración */}
              <div>
                <label className="text-xs font-medium block mb-2" style={{ color: "#6b7c80" }}>Tipo de valoración</label>
                <div className="flex gap-2 flex-wrap">
                  {["Nueva valoración", "Valoración de seguimiento", "Valoración de alta"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAsvForm((f) => ({ ...f, type: t }))}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                      style={asvForm.type === t
                        ? { backgroundColor: "#1a5c58", color: "#fff", borderColor: "#1a5c58" }
                        : { backgroundColor: "transparent", color: "#6b7c80", borderColor: "rgba(28,45,50,0.15)" }
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>Escala</label>
                  <select
                    value={asvForm.scale}
                    onChange={(e) => setAsvForm((f) => ({ ...f, scale: e.target.value }))}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background"
                    style={{ color: "#1c2d32" }}
                  >
                    <option value="">— Seleccionar —</option>
                    {scaleOptions.map((s) => (
                      <option key={s.name} value={s.name}>{s.name} ({s.category})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>
                    Puntuación{selectedScale ? ` (${selectedScale.range})` : ""}
                  </label>
                  <input
                    type="text"
                    value={asvForm.score}
                    onChange={(e) => setAsvForm((f) => ({ ...f, score: e.target.value }))}
                    placeholder="ej. 72"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background"
                    style={{ color: "#1c2d32" }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>Fecha</label>
                  <input
                    type="date"
                    value={asvForm.date}
                    onChange={(e) => setAsvForm((f) => ({ ...f, date: e.target.value }))}
                    className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background"
                    style={{ color: "#1c2d32" }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>Observaciones (opcional)</label>
                  <input
                    type="text"
                    value={asvForm.notes}
                    onChange={(e) => setAsvForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Comentario breve"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-background"
                    style={{ color: "#1c2d32" }}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSaveAssessment}
                  disabled={!asvForm.scale || !asvForm.score}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-40"
                  style={{ backgroundColor: "#1a5c58" }}
                >
                  Guardar valoración
                </button>
                <button
                  onClick={() => setShowAsvForm(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-border"
                  style={{ color: "#6b7c80" }}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {Object.keys(groupedAssessments).length === 0 ? (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <ClipboardCheck size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm" style={{ color: "#6b7c80" }}>Sin valoraciones registradas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(groupedAssessments).map(([scaleName, entries]) => {
                const parseDate = (d: string) => { try { return parse(d, "dd MMM yyyy", new Date(), { locale: es }).getTime(); } catch { return 0; } };
                const sorted = [...entries].sort((a, b) => parseDate(b.date) - parseDate(a.date));
                const latest = sorted[0];
                const history = sorted.slice(1);
                const scaleInfo = scaleOptions.find((s) => s.name === scaleName);
                const isOpen = expandedScale === scaleName;
                const typeColor: Record<string, { bg: string; text: string }> = {
                  "Nueva valoración": { bg: "#e3eeec", text: "#1a5c58" },
                  "Valoración de seguimiento": { bg: "#fdf0e3", text: "#a0621a" },
                  "Valoración de alta": { bg: "#ede9f8", text: "#5b3fa0" },
                };
                const tc = latest.type ? (typeColor[latest.type] ?? { bg: "#f0f0f0", text: "#555" }) : null;
                return (
                  <div key={scaleName} className="bg-card rounded-xl border border-border overflow-hidden"
                    style={{ borderColor: isOpen ? "rgba(26,92,88,0.35)" : undefined }}>
                    {/* Card header — always visible, click to expand */}
                    <button
                      className="w-full text-left px-5 py-4 flex items-center justify-between gap-3 transition-colors hover:bg-muted/30"
                      onClick={() => setExpandedScale(isOpen ? null : scaleName)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold" style={{ color: "#1c2d32" }}>{scaleName}</p>
                          {tc && (
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={{ backgroundColor: tc.bg, color: tc.text }}>
                              {latest.type}
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "#6b7c80" }}>
                          {latest.category}{scaleInfo ? ` · Rango: ${scaleInfo.range}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-xl font-semibold" style={{ fontFamily: "'DM Mono', monospace", color: "#1a5c58" }}>
                            {latest.score}
                          </p>
                          <p className="text-xs" style={{ color: "#6b7c80" }}>{latest.date}</p>
                        </div>
                        <ChevronRight size={15} style={{ color: "#6b7c80", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
                      </div>
                    </button>

                    {/* Expanded detail */}
                    {isOpen && (
                      <div className="px-5 pb-5 border-t border-border">
                        {/* Scale meta strip */}
                        {scaleInfo && (
                          <div className="pt-4 flex flex-wrap gap-4 mb-4">
                            <div>
                              <p className="text-xs" style={{ color: "#6b7c80" }}>Categoría</p>
                              <p className="text-xs font-semibold mt-0.5" style={{ color: "#1c2d32" }}>{scaleInfo.category}</p>
                            </div>
                            <div>
                              <p className="text-xs" style={{ color: "#6b7c80" }}>Rango válido</p>
                              <p className="text-xs font-semibold mt-0.5" style={{ color: "#1c2d32", fontFamily: "'DM Mono', monospace" }}>{scaleInfo.range}</p>
                            </div>
                            <div>
                              <p className="text-xs" style={{ color: "#6b7c80" }}>Mediciones totales</p>
                              <p className="text-xs font-semibold mt-0.5" style={{ color: "#1c2d32", fontFamily: "'DM Mono', monospace" }}>{sorted.length}</p>
                            </div>
                          </div>
                        )}

                        {/* Full history — most recent first */}
                        <div className="space-y-2">
                          {sorted.map((h, idx) => {
                            const htc = h.type ? (typeColor[h.type] ?? { bg: "#f0f0f0", text: "#555" }) : null;
                            return (
                              <div key={h.id} className="rounded-lg border border-border p-3 space-y-2"
                                style={{ backgroundColor: idx === 0 ? "rgba(26,92,88,0.04)" : "transparent" }}>
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-medium" style={{ color: "#6b7c80", fontFamily: "'DM Mono', monospace" }}>{h.date}</span>
                                    {htc && (
                                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                        style={{ backgroundColor: htc.bg, color: htc.text }}>
                                        {h.type}
                                      </span>
                                    )}
                                    {idx === 0 && (
                                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                        style={{ backgroundColor: "#1a5c58", color: "#fff" }}>
                                        Última
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-lg font-semibold flex-shrink-0"
                                    style={{ color: "#1a5c58", fontFamily: "'DM Mono', monospace" }}>
                                    {h.score}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-xs" style={{ color: "#6b7c80" }}>
                                  <span>Evaluador: <span style={{ color: "#1c2d32" }}>{h.observer}</span></span>
                                </div>
                                {h.notes && (
                                  <p className="text-xs leading-relaxed pt-1 border-t border-border/50" style={{ color: "#1c2d32" }}>
                                    {h.notes}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "informes" && (
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "#1c2d32" }}>Plantillas de informe</h3>
            <p className="text-xs mt-0.5" style={{ color: "#6b7c80" }}>Genera informes clínicos estandarizados</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { type: "Informe de evolución", desc: "Resumen del progreso terapéutico desde el inicio del tratamiento" },
              { type: "Informe de alta", desc: "Documentación del cierre del proceso terapéutico y resultados alcanzados" },
              { type: "Derivación", desc: "Informe de derivación a otro profesional o servicio especializado" },
              { type: "Informe para familia", desc: "Resumen adaptado del estado clínico y pautas para el entorno familiar" },
            ].map(({ type, desc }) => (
              <div key={type} className="bg-card rounded-xl border border-border p-4 flex flex-col gap-2">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "#e3eeec" }}>
                    <FileText size={15} style={{ color: "#1a5c58" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "#1c2d32" }}>{type}</p>
                    <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "#6b7c80" }}>{desc}</p>
                  </div>
                </div>
                <button
                  className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border opacity-60 cursor-not-allowed"
                  style={{ color: "#6b7c80" }}
                  disabled
                >
                  Generar · Próximamente
                </button>
              </div>
            ))}
          </div>

          {(() => {
            const patientReports = seedReports.filter((r) => r.patientId === patientId);
            if (patientReports.length === 0) return null;
            return (
              <div>
                <h3 className="text-sm font-semibold mb-3" style={{ color: "#1c2d32" }}>Informes generados</h3>
                <div className="space-y-3">
                  {patientReports.map((r) => (
                    <div key={r.id} className="bg-card rounded-xl border border-border p-4 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                          style={{ backgroundColor: "#fdf0e3" }}>
                          <ClipboardCheck size={14} style={{ color: "#a0621a" }} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "#1c2d32" }}>{r.type}</p>
                          <p className="text-xs mt-0.5" style={{ color: "#6b7c80", fontFamily: "'DM Mono', monospace" }}>
                            {r.date} · {r.author}
                          </p>
                          {r.summary && (
                            <p className="text-xs mt-1.5 leading-relaxed" style={{ color: "#6b7c80" }}>{r.summary}</p>
                          )}
                        </div>
                      </div>
                      <button
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-border flex-shrink-0"
                        style={{ color: "#1c2d32" }}
                      >
                        <Download size={12} />
                        PDF
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {tab === "evolucion" && (
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold" style={{ color: "#1c2d32" }}>Evolución clínica</h3>
              <p className="text-xs mt-0.5" style={{ color: "#6b7c80" }}>Escala 0–10 por sesión</p>
            </div>
            <div className="flex gap-4">
              {progressKeys.map((k) => (
                <div key={k} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: keyColors[k] }} />
                  <span className="text-xs" style={{ color: "#6b7c80" }}>{keyLabels[k] ?? k}</span>
                </div>
              ))}
            </div>
          </div>
          {progress.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={progress} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  {progressKeys.map((k) => (
                    <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={keyColors[k]} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={keyColors[k]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,45,50,0.07)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#6b7c80", fontFamily: "'DM Mono', monospace" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: "#6b7c80" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, border: "1px solid rgba(28,45,50,0.12)", borderRadius: 8, fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  formatter={(value: number, name: string) => [value, keyLabels[name] ?? name]}
                />
                {progressKeys.map((k) => (
                  <Area
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stroke={keyColors[k]}
                    strokeWidth={2}
                    fill={`url(#grad-${k})`}
                    dot={{ fill: keyColors[k], strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-16">
              <TrendingUp size={28} className="mx-auto mb-2 opacity-20" />
              <p className="text-sm" style={{ color: "#6b7c80" }}>Sin datos suficientes para mostrar evolución</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── New Visit Form ───────────────────────────────────────────────────────────

function NewVisitForm({ preselectedId, patients, onSave, onBack }: {
  preselectedId?: string; patients: Patient[]; onSave: (v: Visit) => void; onBack: () => void;
}) {
  const [form, setForm] = useState({
    patientId: preselectedId ?? patients[0]?.id ?? "",
    date: "2026-06-05",
    time: "10:30",
    duration: "45",
    type: "Seguimiento",
    notes: "",
  });
  const [interventions, setInterventions] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  const interventionOptions: Record<Specialty, string[]> = {
    "Fisioterapia": ["Ejercicios activos asistidos", "Reeducación de marcha", "Electroterapia TENS", "Crioterapia", "Masaje terapéutico", "Ejercicios neuromotores"],
    "Psicología": ["Reestructuración cognitiva", "Respiración diafragmática", "TCC", "Mindfulness", "Psicoeducación", "Registro de pensamientos"],
    "T. Ocupacional": ["AVD básicas", "Estimulación cognitiva", "Adaptación de entorno", "Ayudas técnicas", "Educación familiar", "Control motor fino"],
  };

  const selectedPatient = patients.find((p) => p.id === form.patientId)!;
  const options = interventionOptions[selectedPatient.specialty];

  function toggleIntervention(i: string) {
    setInterventions((prev) => prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]);
  }

  function handleSave() {
    const dateObj = new Date(form.date + "T00:00");
    const formattedDate = format(dateObj, "dd MMM yyyy", { locale: es });
    const visit: Visit = {
      id: `v${Date.now()}`,
      patientId: form.patientId,
      date: formattedDate,
      time: form.time,
      duration: Number(form.duration),
      notes: form.notes,
      interventions,
      score: 0,
    };
    onSave(visit);
    setSaved(true);
    setTimeout(() => { onBack(); }, 1000);
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <button onClick={onBack} className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
        style={{ color: "#6b7c80" }}>
        <ArrowLeft size={15} />
        Volver
      </button>
      <div>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "'Fraunces', serif", color: "#1c2d32" }}>
          Registrar visita
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "#6b7c80" }}>Complete los datos de la sesión domiciliaria</p>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-5">
        {/* Patient */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-2"
            style={{ color: "#6b7c80" }}>Paciente</label>
          <select
            value={form.patientId}
            onChange={(e) => setForm({ ...form, patientId: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg text-sm border border-border bg-card outline-none focus:ring-2 focus:ring-primary/30"
            style={{ color: "#1c2d32" }}
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.specialty}</option>
            ))}
          </select>
        </div>

        {/* Date + time + duration */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { key: "date", label: "Fecha", type: "date" },
            { key: "time", label: "Hora", type: "time" },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2"
                style={{ color: "#6b7c80" }}>{label}</label>
              <input
                type={type}
                value={form[key as keyof typeof form] as string}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg text-sm border border-border bg-card outline-none focus:ring-2 focus:ring-primary/30"
                style={{ color: "#1c2d32" }}
              />
            </div>
          ))}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider block mb-2"
              style={{ color: "#6b7c80" }}>Duración</label>
            <select
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
              className="w-full px-3 py-2.5 rounded-lg text-sm border border-border bg-card outline-none focus:ring-2 focus:ring-primary/30"
              style={{ color: "#1c2d32" }}
            >
              {["30", "45", "60", "90"].map((d) => (
                <option key={d} value={d}>{d} min</option>
              ))}
            </select>
          </div>
        </div>

        {/* Visit type */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-2"
            style={{ color: "#6b7c80" }}>Tipo de visita</label>
          <div className="flex flex-wrap gap-2">
            {["Primera visita", "Seguimiento", "Evaluación", "Alta"].map((t) => (
              <button
                key={t}
                onClick={() => setForm({ ...form, type: t })}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={form.type === t
                  ? { backgroundColor: "#1a5c58", color: "#fff" }
                  : { backgroundColor: "#f0f0f0", color: "#6b7c80" }
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Interventions */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-2"
            style={{ color: "#6b7c80" }}>Intervenciones realizadas</label>
          <div className="flex flex-wrap gap-2">
            {options.map((opt) => {
              const active = interventions.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => toggleIntervention(opt)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all border"
                  style={active
                    ? { backgroundColor: "#e3eeec", color: "#1a5c58", borderColor: "#1a5c58" }
                    : { backgroundColor: "#fff", color: "#6b7c80", borderColor: "rgba(28,45,50,0.12)" }
                  }
                >
                  {active && <CheckCircle2 size={11} />}
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-2"
            style={{ color: "#6b7c80" }}>Notas de sesión</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            rows={4}
            placeholder="Describa las intervenciones realizadas, evolución del paciente y observaciones relevantes…"
            className="w-full px-3 py-2.5 rounded-lg text-sm border border-border bg-card outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            style={{ color: "#1c2d32" }}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saved}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-all"
          style={{ backgroundColor: saved ? "#2a6b3f" : "#1a5c58" }}
        >
          {saved ? <><CheckCircle2 size={16} /> Visita registrada</> : "Guardar visita"}
        </button>
      </div>
    </div>
  );
}

// ─── New Patient Form ─────────────────────────────────────────────────────────

const SPECIALTY_COLORS: Record<Specialty, string> = {
  "Fisioterapia": "#1a5c58",
  "Psicología": "#5b3fa0",
  "T. Ocupacional": "#c17f3a",
};

function NewPatientForm({ professionals, onSave, onBack }: {
  professionals: Professional[];
  onSave: (p: Patient) => void;
  onBack: () => void;
}) {
  const [form, setForm] = useState({
    name: "", birthDate: "", specialty: "T. Ocupacional" as Specialty,
    status: "Activo" as Status, phone: "", address: "",
    diagnosis: "", objective: "",
    referentName: "", referentPhone: "",
    startDate: new Date().toISOString().split("T")[0],
  });

  function computedAge(birthDate: string): number | null {
    if (!birthDate) return null;
    const dob = new Date(birthDate);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age > 0 ? age : null;
  }
  const [selectedProfIds, setSelectedProfIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function field(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: "" }));
  }

  function toggleProf(id: string) {
    setSelectedProfIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    if (errors.professionals) setErrors(e => ({ ...e, professionals: "" }));
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "El nombre es obligatorio";
    if (!form.birthDate) e.birthDate = "La fecha de nacimiento es obligatoria";
    else if (computedAge(form.birthDate) === null) e.birthDate = "Introduce una fecha válida";
    if (!form.diagnosis.trim()) e.diagnosis = "El diagnóstico es obligatorio";
    if (selectedProfIds.length === 0) e.professionals = "Asigna al menos un profesional";
    return e;
  }

  function handleSave() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }

    const therapistNames = selectedProfIds
      .map(id => professionals.find(p => p.id === id)?.name)
      .filter(Boolean).join(" / ");

    const dateObj = new Date(form.startDate);
    const formattedDate = isNaN(dateObj.getTime())
      ? form.startDate
      : dateObj.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });

    onSave({
      id: `p${Date.now()}`,
      name: form.name.trim(),
      age: computedAge(form.birthDate) ?? 0,
      birthDate: form.birthDate,
      specialty: form.specialty,
      status: form.status,
      phone: form.phone.trim(),
      address: form.address.trim(),
      diagnosis: form.diagnosis.trim(),
      objective: form.objective.trim(),
      therapist: therapistNames,
      therapistIds: selectedProfIds,
      referentName: form.referentName.trim() || undefined,
      referentPhone: form.referentPhone.trim() || undefined,
      nextVisit: "Sin programar",
      lastVisit: "—",
      totalVisits: 0,
      startDate: formattedDate,
      color: SPECIALTY_COLORS[form.specialty],
    });
  }

  function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#6b7c80" }}>
        {children}
      </p>
    );
  }

  function FieldError({ msg }: { msg?: string }) {
    if (!msg) return null;
    return <p className="text-xs mt-1" style={{ color: "#c0392b" }}>{msg}</p>;
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <button onClick={onBack} className="flex items-center gap-2 text-sm transition-opacity hover:opacity-70"
        style={{ color: "#6b7c80" }}>
        <ArrowLeft size={15} />
        Volver
      </button>
      <div>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "'Didact Gothic', sans-serif", color: "#1c2d32" }}>
          Nueva ficha de paciente
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "#6b7c80" }}>
          Rellene los datos para crear una nueva ficha e iniciar el seguimiento
        </p>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-7">

        {/* ── Datos personales ── */}
        <div>
          <SectionLabel>Datos personales</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium block mb-1.5" style={{ color: "#6b7c80" }}>
                Nombre completo <span style={{ color: "#c0392b" }}>*</span>
              </label>
              <input
                value={form.name} onChange={e => field("name", e.target.value)}
                placeholder="Nombre y apellidos"
                className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-primary/30"
                style={{ borderColor: errors.name ? "#c0392b" : "rgba(28,45,50,0.12)", color: "#1c2d32" }}
              />
              <FieldError msg={errors.name} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: "#6b7c80" }}>
                Fecha de nacimiento <span style={{ color: "#c0392b" }}>*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={form.birthDate} onChange={e => field("birthDate", e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ borderColor: errors.birthDate ? "#c0392b" : "rgba(28,45,50,0.12)", color: "#1c2d32" }}
                />
                {computedAge(form.birthDate) !== null && (
                  <span className="text-xs px-2.5 py-1 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: "#e3eeec", color: "#1a5c58", fontFamily: "'DM Mono', monospace" }}>
                    {computedAge(form.birthDate)} años
                  </span>
                )}
              </div>
              <FieldError msg={errors.birthDate} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: "#6b7c80" }}>Teléfono</label>
              <input
                value={form.phone} onChange={e => field("phone", e.target.value)}
                placeholder="6XX XXX XXX"
                className="w-full px-3 py-2.5 rounded-lg text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30"
                style={{ color: "#1c2d32" }}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium block mb-1.5" style={{ color: "#6b7c80" }}>Domicilio</label>
              <input
                value={form.address} onChange={e => field("address", e.target.value)}
                placeholder="Calle, número, piso — Municipio"
                className="w-full px-3 py-2.5 rounded-lg text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30"
                style={{ color: "#1c2d32" }}
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: "#6b7c80" }}>Persona de referencia</label>
              <input
                value={form.referentName} onChange={e => field("referentName", e.target.value)}
                placeholder="Nombre del familiar o cuidador"
                className="w-full px-3 py-2.5 rounded-lg text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30"
                style={{ color: "#1c2d32" }}
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: "#6b7c80" }}>Teléfono de contacto</label>
              <input
                value={form.referentPhone} onChange={e => field("referentPhone", e.target.value)}
                placeholder="6XX XXX XXX"
                className="w-full px-3 py-2.5 rounded-lg text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30"
                style={{ color: "#1c2d32" }}
              />
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(28,45,50,0.08)" }} />

        {/* ── Información clínica ── */}
        <div>
          <SectionLabel>Información clínica</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: "#6b7c80" }}>Especialidad</label>
              <select
                value={form.specialty}
                onChange={e => setForm(f => ({ ...f, specialty: e.target.value as Specialty }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30"
                style={{ color: "#1c2d32" }}
              >
                <option value="T. Ocupacional">Terapia Ocupacional</option>
                <option value="Fisioterapia">Fisioterapia</option>
                <option value="Psicología">Psicología</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: "#6b7c80" }}>Estado</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as Status }))}
                className="w-full px-3 py-2.5 rounded-lg text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30"
                style={{ color: "#1c2d32" }}
              >
                <option value="Activo">Activo</option>
                <option value="En seguimiento">En seguimiento</option>
                <option value="Alta">Alta</option>
                <option value="Pausado">Pausado</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium block mb-1.5" style={{ color: "#6b7c80" }}>
                Diagnóstico principal <span style={{ color: "#c0392b" }}>*</span>
              </label>
              <input
                value={form.diagnosis} onChange={e => field("diagnosis", e.target.value)}
                placeholder="Diagnóstico médico o razón de derivación"
                className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-primary/30"
                style={{ borderColor: errors.diagnosis ? "#c0392b" : "rgba(28,45,50,0.12)", color: "#1c2d32" }}
              />
              <FieldError msg={errors.diagnosis} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-medium block mb-1.5" style={{ color: "#6b7c80" }}>
                Objetivo terapéutico
              </label>
              <textarea
                value={form.objective} onChange={e => field("objective", e.target.value)}
                rows={2}
                placeholder="Describa el objetivo principal del tratamiento…"
                className="w-full px-3 py-2.5 rounded-lg text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                style={{ color: "#1c2d32" }}
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: "#6b7c80" }}>
                Fecha de inicio
              </label>
              <input
                type="date" value={form.startDate}
                onChange={e => field("startDate", e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-sm border border-border outline-none focus:ring-2 focus:ring-primary/30"
                style={{ color: "#1c2d32" }}
              />
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(28,45,50,0.08)" }} />

        {/* ── Profesionales asignados ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <SectionLabel>
              Profesionales asignados <span style={{ color: "#c0392b" }}>*</span>
            </SectionLabel>
            {selectedProfIds.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: "#e3eeec", color: "#1a5c58" }}>
                {selectedProfIds.length} seleccionado{selectedProfIds.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {professionals.filter(p => p.active).length === 0 ? (
            <p className="text-sm" style={{ color: "#6b7c80" }}>
              No hay profesionales activos. Añade profesionales en Configuración.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {professionals.filter(p => p.active).map(p => {
                const selected = selectedProfIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleProf(p.id)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all hover:shadow-sm"
                    style={{
                      borderColor: selected ? p.color : "rgba(28,45,50,0.1)",
                      backgroundColor: selected ? `${p.color}10` : "#fff",
                    }}
                  >
                    <Avatar name={p.name} color={p.color} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "#1c2d32" }}>{p.name}</p>
                      <p className="text-xs truncate" style={{ color: "#6b7c80" }}>{p.role}</p>
                    </div>
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        borderColor: selected ? p.color : "rgba(28,45,50,0.2)",
                        backgroundColor: selected ? p.color : "transparent",
                      }}
                    >
                      {selected && <CheckCircle2 size={12} color="white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <FieldError msg={errors.professionals} />
        </div>

        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#1a5c58" }}
        >
          <UserPlus size={16} />
          Crear ficha de paciente
        </button>
      </div>
    </div>
  );
}

// ─── Team View ────────────────────────────────────────────────────────────────

const emptyProfForm = {
  name: "", role: "Terapeuta Ocupacional" as string,
  numColegiado: "", phone: "", email: "", active: true, color: AVATAR_COLORS[0],
};

function TeamView({ professionals, patientList, onAdd, onUpdate, onDelete, onSelectPatient }: {
  professionals: Professional[];
  patientList: Patient[];
  onAdd: (p: Professional) => void;
  onUpdate: (p: Professional) => void;
  onDelete: (id: string) => void;
  onSelectPatient: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyProfForm });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function getPatientsFor(prof: Professional) {
    return patientList.filter(p =>
      p.therapistIds?.includes(prof.id) ||
      p.therapist.split(" / ").some(n => n.trim() === prof.name)
    );
  }

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyProfForm });
    setShowForm(true);
    setTimeout(() => document.getElementById("prof-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function openEdit(p: Professional) {
    setEditingId(p.id);
    setForm({ name: p.name, role: p.role, numColegiado: p.numColegiado, phone: p.phone, email: p.email, active: p.active, color: p.color });
    setShowForm(true);
    setTimeout(() => document.getElementById("prof-form")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  function handleSave() {
    if (!form.name.trim()) return;
    if (editingId) {
      onUpdate({ id: editingId, joined: professionals.find(p => p.id === editingId)!.joined, ...form });
    } else {
      onAdd({ id: `prof${Date.now()}`, joined: new Date().toLocaleDateString("es-ES", { month: "short", year: "numeric" }), ...form });
    }
    setShowForm(false);
    setEditingId(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "'Didact Gothic', sans-serif", color: "#1c2d32" }}>
            Equipo profesional
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#6b7c80" }}>
            {professionals.length} profesionales · {professionals.filter(p => p.active).length} activos
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90 self-start sm:self-auto"
          style={{ backgroundColor: "#1a5c58" }}
        >
          <UserPlus size={15} />
          Añadir profesional
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div id="prof-form" className="bg-card rounded-xl border-2 p-5 space-y-5" style={{ borderColor: "#1a5c58" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold" style={{ color: "#1c2d32" }}>
              {editingId ? "Editar profesional" : "Nuevo profesional"}
            </h3>
            <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-muted/50 transition-colors">
              <X size={14} style={{ color: "#6b7c80" }} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { key: "name", label: "Nombre completo", placeholder: "Nombre y apellidos", mono: false },
              { key: "numColegiado", label: "Nº de colegiado", placeholder: "Ej. 28-TO-1234", mono: true },
              { key: "phone", label: "Teléfono", placeholder: "6XX XXX XXX", mono: false },
              { key: "email", label: "Correo electrónico", placeholder: "nombre@domusges.es", mono: false },
            ].map(({ key, label, placeholder, mono }) => (
              <div key={key}>
                <label className="text-xs font-medium block mb-1.5" style={{ color: "#6b7c80" }}>{label}</label>
                <input
                  value={form[key as keyof typeof form] as string}
                  onChange={e => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                  className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ color: "#1c2d32", fontFamily: mono ? "'DM Mono', monospace" : undefined }}
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="text-xs font-medium block mb-1.5" style={{ color: "#6b7c80" }}>Categoría profesional</label>
              <select
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background outline-none focus:ring-2 focus:ring-primary/30"
                style={{ color: "#1c2d32" }}
              >
                {PROF_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: "#6b7c80" }}>Color</label>
              <div className="flex gap-2">
                {AVATAR_COLORS.map(c => (
                  <button key={c} onClick={() => setForm({ ...form, color: c })}
                    className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex-shrink-0"
                    style={{ backgroundColor: c, outline: form.color === c ? `2px solid ${c}` : "none", outlineOffset: 2 }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-end pb-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <button onClick={() => setForm({ ...form, active: !form.active })} className="flex-shrink-0">
                  {form.active
                    ? <ToggleRight size={24} style={{ color: "#1a5c58" }} />
                    : <ToggleLeft size={24} style={{ color: "#b0bec5" }} />}
                </button>
                <span className="text-sm" style={{ color: "#1c2d32" }}>{form.active ? "Activo" : "Inactivo"}</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg text-xs font-medium border border-border hover:bg-muted/40 transition-colors"
              style={{ color: "#6b7c80" }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={!form.name.trim()}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: "#1a5c58" }}>
              {editingId ? "Guardar cambios" : "Crear profesional"}
            </button>
          </div>
        </div>
      )}

      {/* Professional cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {professionals.map(prof => {
          const assigned = getPatientsFor(prof);
          return (
            <div key={prof.id} className="bg-card rounded-xl border border-border overflow-hidden flex flex-col">
              {/* Card header */}
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar name={prof.name} color={prof.color} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="text-sm font-semibold" style={{ color: "#1c2d32" }}>{prof.name}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={prof.active
                          ? { backgroundColor: "#e6f4ea", color: "#256d35" }
                          : { backgroundColor: "#f0f0f0", color: "#888" }}>
                        {prof.active ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <BadgeCheck size={12} style={{ color: "#6b7c80" }} />
                      <p className="text-xs" style={{ color: "#6b7c80" }}>{prof.role}</p>
                    </div>
                    {prof.numColegiado && (
                      <p className="text-xs" style={{ color: "#b0bec5", fontFamily: "'DM Mono', monospace" }}>
                        {prof.numColegiado}
                      </p>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => onUpdate({ ...prof, active: !prof.active })}
                      className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors" title="Activar/Desactivar">
                      {prof.active
                        ? <ToggleRight size={18} style={{ color: "#1a5c58" }} />
                        : <ToggleLeft size={18} style={{ color: "#b0bec5" }} />}
                    </button>
                    <button onClick={() => openEdit(prof)}
                      className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors" title="Editar">
                      <Pencil size={13} style={{ color: "#6b7c80" }} />
                    </button>
                    {confirmDelete === prof.id ? (
                      <>
                        <button onClick={() => { onDelete(prof.id); setConfirmDelete(null); }}
                          className="p-1.5 rounded-lg transition-colors" style={{ backgroundColor: "#fde8e8" }} title="Confirmar eliminación">
                          <CheckCircle2 size={13} style={{ color: "#b91c1c" }} />
                        </button>
                        <button onClick={() => setConfirmDelete(null)}
                          className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors" title="Cancelar">
                          <X size={13} style={{ color: "#6b7c80" }} />
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDelete(prof.id)}
                        className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors" title="Eliminar">
                        <Trash2 size={13} style={{ color: "#6b7c80" }} />
                      </button>
                    )}
                  </div>
                </div>
                {/* Contact */}
                <div className="flex flex-wrap gap-4 mt-3">
                  {prof.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone size={11} style={{ color: "#b0bec5" }} />
                      <span className="text-xs" style={{ color: "#6b7c80" }}>{prof.phone}</span>
                    </div>
                  )}
                  {prof.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail size={11} style={{ color: "#b0bec5" }} />
                      <span className="text-xs" style={{ color: "#6b7c80" }}>{prof.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Patients section */}
              <div className="px-5 py-4 flex-1" style={{ borderTop: "1px solid rgba(28,45,50,0.07)", backgroundColor: "#faf9f7" }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#6b7c80" }}>
                  Pacientes asignados
                  <span className="ml-2 normal-case font-normal"
                    style={{ color: assigned.length > 0 ? "#1a5c58" : "#b0bec5" }}>
                    ({assigned.length})
                  </span>
                </p>
                {assigned.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {assigned.map(pat => (
                      <button
                        key={pat.id}
                        onClick={() => onSelectPatient(pat.id)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
                        style={{ backgroundColor: `${pat.color}18`, color: pat.color, border: `1px solid ${pat.color}30` }}
                      >
                        <Avatar name={pat.name} color={pat.color} size="sm" />
                        <span>{pat.name.split(" ").slice(0, 2).join(" ")}</span>
                        <span style={{ color: `${pat.color}80` }}>·</span>
                        <StatusBadge status={pat.status} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs" style={{ color: "#b0bec5" }}>Sin pacientes asignados actualmente</p>
                )}
              </div>
            </div>
          );
        })}

        {professionals.length === 0 && (
          <div className="lg:col-span-2 bg-card rounded-xl border border-border py-16 text-center">
            <Users2 size={36} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium" style={{ color: "#1c2d32" }}>No hay profesionales registrados</p>
            <p className="text-xs mt-1" style={{ color: "#6b7c80" }}>Añade el primer miembro del equipo con el botón de arriba</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Settings View ────────────────────────────────────────────────────────────

// ─── Billing View ────────────────────────────────────────────────────────────

const PRICE_SEGUIMIENTO = 60;
const PRICE_VALORACION = 90;

function BillingView({ professionals, patients, visitHistory, assessments }: {
  professionals: Professional[];
  patients: Patient[];
  visitHistory: Record<string, Visit[]>;
  assessments: Assessment[];
}) {
  const [period, setPeriod] = useState<"month" | "all">("month");
  const [expandedProfId, setExpandedProfId] = useState<string | null>(null);

  const now = new Date();

  function isInPeriod(dateStr: string) {
    if (period === "all") return true;
    try {
      const d = parse(dateStr, "dd MMM yyyy", new Date(), { locale: es });
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    } catch { return false; }
  }

  const allVisits = Object.values(visitHistory).flat();

  const billingData = professionals.map((prof) => {
    const profPatients = patients.filter(
      (p) => p.therapistIds?.includes(prof.id) || p.therapist === prof.name
    );
    const profPatientIds = profPatients.map((p) => p.id);

    const filteredVisits = allVisits.filter(
      (v) => profPatientIds.includes(v.patientId) && isInPeriod(v.date)
    );
    const filteredAssessments = assessments.filter(
      (a) => profPatientIds.includes(a.patientId) && isInPeriod(a.date)
    );

    const visitTotal = filteredVisits.length * PRICE_SEGUIMIENTO;
    const assessmentTotal = filteredAssessments.length * PRICE_VALORACION;

    return {
      prof,
      visits: filteredVisits,
      assessments: filteredAssessments,
      visitTotal,
      assessmentTotal,
      total: visitTotal + assessmentTotal,
      profPatients,
    };
  }).filter((d) => d.total > 0 || period === "all");

  const grandTotal = billingData.reduce((sum, d) => sum + d.total, 0);
  const totalVisits = billingData.reduce((sum, d) => sum + d.visits.length, 0);
  const totalAssessments = billingData.reduce((sum, d) => sum + d.assessments.length, 0);

  const periodLabel = period === "month"
    ? format(now, "MMMM yyyy", { locale: es }).replace(/^\w/, (c) => c.toUpperCase())
    : "Todo el período";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "'Didact Gothic', sans-serif", color: "#1c2d32" }}>
            Facturación
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6b7c80" }}>
            Sesiones completadas · {periodLabel}
          </p>
        </div>
        {/* Period toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg border border-border bg-card">
          {(["month", "all"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{
                backgroundColor: period === p ? "#1a5c58" : "transparent",
                color: period === p ? "#fff" : "#6b7c80",
              }}
            >
              {p === "month" ? "Este mes" : "Todo"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-xs font-medium mb-1" style={{ color: "#6b7c80" }}>Total facturado</p>
          <p className="text-3xl font-semibold" style={{ fontFamily: "'Fraunces', serif", color: "#1a5c58" }}>
            {grandTotal.toLocaleString("es-ES")} €
          </p>
          <p className="text-xs mt-1" style={{ color: "#9ab0ad" }}>
            {totalVisits + totalAssessments} sesiones en total
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-xs font-medium mb-1" style={{ color: "#6b7c80" }}>Sesiones de seguimiento</p>
          <p className="text-3xl font-semibold" style={{ fontFamily: "'Fraunces', serif", color: "#1c2d32" }}>
            {totalVisits}
          </p>
          <p className="text-xs mt-1" style={{ color: "#9ab0ad" }}>
            {(totalVisits * PRICE_SEGUIMIENTO).toLocaleString("es-ES")} € · {PRICE_SEGUIMIENTO} € / sesión
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-5">
          <p className="text-xs font-medium mb-1" style={{ color: "#6b7c80" }}>Valoraciones</p>
          <p className="text-3xl font-semibold" style={{ fontFamily: "'Fraunces', serif", color: "#1c2d32" }}>
            {totalAssessments}
          </p>
          <p className="text-xs mt-1" style={{ color: "#9ab0ad" }}>
            {(totalAssessments * PRICE_VALORACION).toLocaleString("es-ES")} € · {PRICE_VALORACION} € / valoración
          </p>
        </div>
      </div>

      {/* Per-professional breakdown */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: "#6b7c80" }}>
          Desglose por profesional
        </p>

        {billingData.length === 0 ? (
          <div className="bg-card rounded-xl border border-border px-5 py-10 text-center">
            <Receipt size={32} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm" style={{ color: "#6b7c80" }}>No hay sesiones registradas en este período</p>
          </div>
        ) : (
          billingData.map(({ prof, visits, assessments: asmts, visitTotal, assessmentTotal, total, profPatients }) => {
            const isExpanded = expandedProfId === prof.id;
            // Merge sessions into a unified list sorted by date desc
            type BillingLine = { date: string; type: "seguimiento" | "valoracion"; patient: string; amount: number };
            const lines: BillingLine[] = [
              ...visits.map((v) => ({
                date: v.date,
                type: "seguimiento" as const,
                patient: patients.find((p) => p.id === v.patientId)?.name ?? "—",
                amount: PRICE_SEGUIMIENTO,
              })),
              ...asmts.map((a) => ({
                date: a.date,
                type: "valoracion" as const,
                patient: patients.find((p) => p.id === a.patientId)?.name ?? "—",
                amount: PRICE_VALORACION,
              })),
            ].sort((a, b) => {
              try {
                return parse(b.date, "dd MMM yyyy", new Date(), { locale: es }).getTime()
                  - parse(a.date, "dd MMM yyyy", new Date(), { locale: es }).getTime();
              } catch { return 0; }
            });

            return (
              <div key={prof.id} className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Prof header row */}
                <button
                  onClick={() => setExpandedProfId(isExpanded ? null : prof.id)}
                  className="w-full flex items-center gap-3 px-4 py-4 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
                    style={{ backgroundColor: prof.color }}>
                    {getInitials(prof.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "#1c2d32" }}>{prof.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#6b7c80" }}>
                      {prof.role} · {visits.length} seguimiento{visits.length !== 1 ? "s" : ""} · {asmts.length} valoraci{asmts.length !== 1 ? "ones" : "ón"}
                    </p>
                  </div>
                  {/* Mini bar */}
                  <div className="hidden sm:flex flex-col items-end gap-1 mr-3">
                    {visitTotal > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs" style={{ color: "#6b7c80" }}>Seg.</span>
                        <span className="text-xs font-medium" style={{ color: "#1c2d32", fontFamily: "'DM Mono', monospace" }}>
                          {visitTotal.toLocaleString("es-ES")} €
                        </span>
                      </div>
                    )}
                    {assessmentTotal > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs" style={{ color: "#6b7c80" }}>Val.</span>
                        <span className="text-xs font-medium" style={{ color: "#1c2d32", fontFamily: "'DM Mono', monospace" }}>
                          {assessmentTotal.toLocaleString("es-ES")} €
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-base font-semibold" style={{ fontFamily: "'Fraunces', serif", color: "#1a5c58" }}>
                      {total.toLocaleString("es-ES")} €
                    </span>
                    <ChevronRight size={15} className="transition-transform"
                      style={{ color: "#9ab0ad", transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)" }} />
                  </div>
                </button>

                {/* Expanded session list */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid rgba(28,45,50,0.08)" }}>
                    {/* Column headers */}
                    <div className="grid grid-cols-12 px-4 py-2 text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "#9ab0ad", backgroundColor: "rgba(28,45,50,0.02)" }}>
                      <span className="col-span-3">Fecha</span>
                      <span className="col-span-4">Paciente</span>
                      <span className="col-span-3">Tipo</span>
                      <span className="col-span-2 text-right">Importe</span>
                    </div>
                    {lines.map((line, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-12 px-4 py-2.5 items-center text-sm"
                        style={{ borderTop: i > 0 ? "1px solid rgba(28,45,50,0.05)" : undefined }}
                      >
                        <span className="col-span-3 text-xs" style={{ color: "#6b7c80", fontFamily: "'DM Mono', monospace" }}>
                          {line.date}
                        </span>
                        <span className="col-span-4 text-xs truncate pr-2" style={{ color: "#1c2d32" }}>
                          {line.patient}
                        </span>
                        <span className="col-span-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                            style={
                              line.type === "valoracion"
                                ? { backgroundColor: "#ede8f7", color: "#5b3fa0" }
                                : { backgroundColor: "#e3eeec", color: "#1a5c58" }
                            }>
                            {line.type === "valoracion" ? "Valoración" : "Seguimiento"}
                          </span>
                        </span>
                        <span className="col-span-2 text-right text-xs font-semibold"
                          style={{ color: "#1c2d32", fontFamily: "'DM Mono', monospace" }}>
                          {line.amount} €
                        </span>
                      </div>
                    ))}
                    {/* Subtotal row */}
                    <div className="flex items-center justify-between px-4 py-3"
                      style={{ borderTop: "1px solid rgba(28,45,50,0.08)", backgroundColor: "rgba(28,45,50,0.02)" }}>
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#6b7c80" }}>
                        Subtotal {prof.name.split(" ")[0]}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: "#1a5c58", fontFamily: "'DM Mono', monospace" }}>
                        {total.toLocaleString("es-ES")} €
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Grand total */}
        {billingData.length > 0 && (
          <div className="flex items-center justify-between px-5 py-4 rounded-xl"
            style={{ backgroundColor: "#1a5c58" }}>
            <span className="text-sm font-semibold text-white">Total a facturar — {periodLabel}</span>
            <span className="text-xl font-semibold text-white" style={{ fontFamily: "'Fraunces', serif" }}>
              {grandTotal.toLocaleString("es-ES")} €
            </span>
          </div>
        )}
      </div>

      {/* Price reference */}
      <div className="flex gap-3 flex-wrap">
        {[
          { label: "Sesión de seguimiento", price: PRICE_SEGUIMIENTO },
          { label: "Sesión de valoración", price: PRICE_VALORACION },
        ].map(({ label, price }) => (
          <div key={label} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-xs"
            style={{ color: "#6b7c80" }}>
            <span>{label}</span>
            <span className="font-semibold" style={{ color: "#1c2d32", fontFamily: "'DM Mono', monospace" }}>
              {price} €
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Admin Users View ────────────────────────────────────────────────────────

function AdminUsersView({ professionals, onAddProfessional, onUpdateProfessional }: {
  professionals: Professional[];
  onAddProfessional: (p: Professional) => void;
  onUpdateProfessional: (p: Professional) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", role: PROF_ROLES[0] as string, email: "", phone: "",
    numColegiado: "", password: "", confirmPassword: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [resetSentFor, setResetSentFor] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "", role: PROF_ROLES[0] as string, email: "", phone: "",
    numColegiado: "", newPassword: "",
  });
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editShowPw, setEditShowPw] = useState(false);

  function openEdit(prof: Professional) {
    setEditingId(prof.id);
    setEditForm({
      name: prof.name,
      role: prof.role,
      email: prof.email,
      phone: prof.phone,
      numColegiado: prof.numColegiado,
      newPassword: "",
    });
    setEditErrors({});
    setEditShowPw(false);
  }

  function validateEdit() {
    const e: Record<string, string> = {};
    if (!editForm.name.trim()) e.name = "El nombre es obligatorio";
    if (!editForm.email.trim() || !editForm.email.includes("@")) e.email = "Introduce un email válido";
    if (editForm.newPassword && editForm.newPassword.length < 6) e.newPassword = "Mínimo 6 caracteres";
    return e;
  }

  function handleSaveEdit(prof: Professional) {
    const e = validateEdit();
    if (Object.keys(e).length > 0) { setEditErrors(e); return; }
    const updated: Professional = {
      ...prof,
      name: editForm.name.trim(),
      role: editForm.role,
      email: editForm.email.trim(),
      phone: editForm.phone.trim(),
      numColegiado: editForm.numColegiado.trim() || "—",
      ...(editForm.newPassword ? { password: editForm.newPassword } : {}),
    };
    onUpdateProfessional(updated);
    setEditingId(null);
  }

  const nonAdminProfs = professionals.filter((p) => !p.isAdmin);
  const profColors = ["#1a5c58", "#5b3fa0", "#c17f3a", "#b03060", "#2a6b3f", "#1a5c80", "#7c3a5c", "#3a6b5c"];

  function validate() {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "El nombre es obligatorio";
    if (!form.email.trim() || !form.email.includes("@")) e.email = "Introduce un email válido";
    if (!form.password || form.password.length < 6) e.password = "Mínimo 6 caracteres";
    if (form.password !== form.confirmPassword) e.confirmPassword = "Las contraseñas no coinciden";
    return e;
  }

  function handleCreate() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    const usedColors = professionals.map((p) => p.color);
    const color = profColors.find((c) => !usedColors.includes(c)) ?? profColors[0];
    const p: Professional = {
      id: `prof${Date.now()}`,
      name: form.name.trim(),
      role: form.role,
      email: form.email.trim(),
      phone: form.phone.trim(),
      numColegiado: form.numColegiado.trim() || "—",
      active: true,
      color,
      joined: format(new Date(), "MMM yyyy", { locale: es }),
      password: form.password,
    };
    onAddProfessional(p);
    setSuccessEmail(form.email.trim());
    setForm({ name: "", role: PROF_ROLES[0], email: "", phone: "", numColegiado: "", password: "", confirmPassword: "" });
    setErrors({});
    setShowForm(false);
  }

  function FieldErr({ msg }: { msg?: string }) {
    if (!msg) return null;
    return <p className="text-xs mt-1" style={{ color: "#c0392b" }}>{msg}</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "'Didact Gothic', sans-serif", color: "#1c2d32" }}>
            Gestión de usuarios
          </h1>
          <p className="text-sm mt-1" style={{ color: "#6b7c80" }}>
            Crea y administra los perfiles de acceso de cada profesional
          </p>
        </div>
        <button
          onClick={() => { setShowForm((v) => !v); setSuccessEmail(null); setErrors({}); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white flex-shrink-0 transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#1a5c58" }}>
          <UserPlus size={15} />
          Nuevo profesional
        </button>
      </div>

      {/* Success banner */}
      {successEmail && (
        <div className="flex items-start gap-3 p-4 rounded-xl border"
          style={{ backgroundColor: "#e3eeec", borderColor: "#1a5c58" }}>
          <CheckCircle2 size={16} style={{ color: "#1a5c58", flexShrink: 0, marginTop: 1 }} />
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: "#1a5c58" }}>Perfil creado correctamente</p>
            <p className="text-xs mt-0.5" style={{ color: "#1c2d32" }}>
              Se ha enviado el correo de confirmación de acceso a <strong>{successEmail}</strong> con las credenciales de acceso.
            </p>
          </div>
          <button onClick={() => setSuccessEmail(null)} style={{ color: "#1a5c58" }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Reset password confirmation */}
      {resetSentFor && (
        <div className="flex items-start gap-3 p-4 rounded-xl border"
          style={{ backgroundColor: "#fdf0e3", borderColor: "#c17f3a" }}>
          <Mail size={15} style={{ color: "#a0621a", flexShrink: 0, marginTop: 1 }} />
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: "#a0621a" }}>Correo de restablecimiento enviado</p>
            <p className="text-xs mt-0.5" style={{ color: "#1c2d32" }}>
              Enlace de restablecimiento enviado a{" "}
              <strong>{professionals.find((p) => p.id === resetSentFor)?.email}</strong>
            </p>
          </div>
          <button onClick={() => setResetSentFor(null)} style={{ color: "#a0621a" }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* New professional form */}
      {showForm && (
        <div className="bg-card rounded-xl border border-border p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "#e3eeec" }}>
              <UserPlus size={15} style={{ color: "#1a5c58" }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#1c2d32" }}>Nuevo perfil profesional</p>
              <p className="text-xs" style={{ color: "#6b7c80" }}>Rellena los datos para crear el acceso</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>
                Nombre completo <span style={{ color: "#c0392b" }}>*</span>
              </label>
              <input value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nombre y apellidos"
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-primary/30"
                style={{ borderColor: errors.name ? "#c0392b" : "rgba(28,45,50,0.12)", color: "#1c2d32" }} />
              <FieldErr msg={errors.name} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>Especialidad / Rol</label>
              <select value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background"
                style={{ color: "#1c2d32" }}>
                {PROF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>N° Colegiado</label>
              <input value={form.numColegiado}
                onChange={(e) => setForm((f) => ({ ...f, numColegiado: e.target.value }))}
                placeholder="XX-FT-0000"
                className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background"
                style={{ color: "#1c2d32" }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>
                Email <span style={{ color: "#c0392b" }}>*</span>
              </label>
              <input type="email" value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="nombre@domusges.es"
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-primary/30"
                style={{ borderColor: errors.email ? "#c0392b" : "rgba(28,45,50,0.12)", color: "#1c2d32" }} />
              <FieldErr msg={errors.email} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>Teléfono</label>
              <input value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="6XX XXX XXX"
                className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background"
                style={{ color: "#1c2d32" }} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>
                Contraseña <span style={{ color: "#c0392b" }}>*</span>
              </label>
              <div className="relative">
                <input type={showPw ? "text" : "password"} value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3 py-2 pr-9 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-primary/30"
                  style={{ borderColor: errors.password ? "#c0392b" : "rgba(28,45,50,0.12)", color: "#1c2d32" }} />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: "#6b7c80" }}>
                  {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <FieldErr msg={errors.password} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>
                Confirmar contraseña <span style={{ color: "#c0392b" }}>*</span>
              </label>
              <input type="password" value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                placeholder="Repite la contraseña"
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-primary/30"
                style={{ borderColor: errors.confirmPassword ? "#c0392b" : "rgba(28,45,50,0.12)", color: "#1c2d32" }} />
              <FieldErr msg={errors.confirmPassword} />
            </div>
          </div>

          <div className="flex items-center gap-2 py-3 border-t border-border text-xs" style={{ color: "#6b7c80" }}>
            <Mail size={12} />
            Se enviará un correo de confirmación de acceso con las credenciales al email indicado
          </div>

          <div className="flex gap-2">
            <button onClick={handleCreate}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#1a5c58" }}>
              Crear perfil y enviar acceso
            </button>
            <button onClick={() => { setShowForm(false); setErrors({}); }}
              className="px-4 py-2 rounded-lg text-sm font-medium border border-border"
              style={{ color: "#6b7c80" }}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Professionals list */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider px-1" style={{ color: "#6b7c80" }}>
          Profesionales registrados ({nonAdminProfs.length})
        </p>
        {nonAdminProfs.length === 0 ? (
          <div className="bg-card rounded-xl border border-border px-5 py-10 text-center">
            <Users2 size={32} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium" style={{ color: "#6b7c80" }}>
              Aún no hay profesionales. Crea el primero con el botón de arriba.
            </p>
          </div>
        ) : (
          nonAdminProfs.map((prof) => (
            <div key={prof.id} className="bg-card rounded-xl border border-border overflow-hidden">
              {editingId === prof.id ? (
                /* ── Edit form ── */
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold" style={{ color: "#1c2d32" }}>Editar perfil</p>
                    <button onClick={() => setEditingId(null)} style={{ color: "#6b7c80" }}>
                      <X size={15} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>
                        Nombre completo <span style={{ color: "#c0392b" }}>*</span>
                      </label>
                      <input value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-primary/30"
                        style={{ borderColor: editErrors.name ? "#c0392b" : "rgba(28,45,50,0.12)", color: "#1c2d32" }} />
                      {editErrors.name && <p className="text-xs mt-1" style={{ color: "#c0392b" }}>{editErrors.name}</p>}
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>Especialidad / Rol</label>
                      <select value={editForm.role}
                        onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background"
                        style={{ color: "#1c2d32" }}>
                        {PROF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>N° Colegiado</label>
                      <input value={editForm.numColegiado}
                        onChange={(e) => setEditForm((f) => ({ ...f, numColegiado: e.target.value }))}
                        placeholder="XX-FT-0000"
                        className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background"
                        style={{ color: "#1c2d32" }} />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>
                        Email <span style={{ color: "#c0392b" }}>*</span>
                      </label>
                      <input type="email" value={editForm.email}
                        onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-primary/30"
                        style={{ borderColor: editErrors.email ? "#c0392b" : "rgba(28,45,50,0.12)", color: "#1c2d32" }} />
                      {editErrors.email && <p className="text-xs mt-1" style={{ color: "#c0392b" }}>{editErrors.email}</p>}
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>Teléfono</label>
                      <input value={editForm.phone}
                        onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="6XX XXX XXX"
                        className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background"
                        style={{ color: "#1c2d32" }} />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>
                        Nueva contraseña <span style={{ color: "#9ab0ad" }}>(opcional)</span>
                      </label>
                      <div className="relative">
                        <input type={editShowPw ? "text" : "password"} value={editForm.newPassword}
                          onChange={(e) => setEditForm((f) => ({ ...f, newPassword: e.target.value }))}
                          placeholder="Dejar vacío para no cambiar"
                          className="w-full px-3 py-2 pr-9 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-primary/30"
                          style={{ borderColor: editErrors.newPassword ? "#c0392b" : "rgba(28,45,50,0.12)", color: "#1c2d32" }} />
                        <button type="button" onClick={() => setEditShowPw((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: "#6b7c80" }}>
                          {editShowPw ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                      {editErrors.newPassword && <p className="text-xs mt-1" style={{ color: "#c0392b" }}>{editErrors.newPassword}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => handleSaveEdit(prof)}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
                      style={{ backgroundColor: "#1a5c58" }}>
                      Guardar cambios
                    </button>
                    <button onClick={() => setEditingId(null)}
                      className="px-4 py-2 rounded-lg text-sm font-medium border border-border"
                      style={{ color: "#6b7c80" }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Normal card ── */
                <div className="px-4 py-3.5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
                    style={{ backgroundColor: prof.color }}>
                    {getInitials(prof.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: "#1c2d32" }}>{prof.name}</p>
                      <span className="text-xs px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: prof.active ? "#e3eeec" : "#f5f5f5", color: prof.active ? "#1a5c58" : "#999" }}>
                        {prof.active ? "Activo" : "Inactivo"}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "#6b7c80" }}>
                      {prof.role} · <span style={{ fontFamily: "'DM Mono', monospace" }}>{prof.email}</span>
                    </p>
                    {prof.numColegiado && prof.numColegiado !== "—" && (
                      <p className="text-xs mt-0.5" style={{ color: "#9ab0ad", fontFamily: "'DM Mono', monospace" }}>
                        Nº {prof.numColegiado}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => openEdit(prof)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-border hover:bg-muted/30 transition-colors"
                      style={{ color: "#1c2d32" }}>
                      <Pencil size={11} />
                      Editar
                    </button>
                    <button
                      onClick={() => onUpdateProfessional({ ...prof, active: !prof.active })}
                      className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                      title={prof.active ? "Desactivar acceso" : "Activar acceso"}
                      style={{ color: "#6b7c80" }}>
                      {prof.active ? <ToggleRight size={18} style={{ color: "#1a5c58" }} /> : <ToggleLeft size={18} />}
                    </button>
                    <button
                      onClick={() => setResetSentFor(prof.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-border hover:bg-muted/30 transition-colors"
                      style={{ color: "#6b7c80" }}>
                      <KeyRound size={11} />
                      Resetear
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SettingsView({ loggedInProfId, professionals, onAddProfessional, onUpdateProfessional }: {
  loggedInProfId: string | null;
  professionals: Professional[];
  onAddProfessional: (p: Professional) => void;
  onUpdateProfessional: (p: Professional) => void;
}) {
  const isAdmin = professionals.find((p) => p.id === loggedInProfId)?.isAdmin ?? false;

  const [showNewUserForm, setShowNewUserForm] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: "", role: PROF_ROLES[0] as string, email: "", phone: "",
    numColegiado: "", password: "", confirmPassword: "",
  });
  const [newUserErrors, setNewUserErrors] = useState<Record<string, string>>({});
  const [newUserSuccess, setNewUserSuccess] = useState<string | null>(null);
  const [resetSentFor, setResetSentFor] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const profColors = ["#1a5c58", "#5b3fa0", "#c17f3a", "#b03060", "#2a6b3f", "#1a5c80", "#7c3a5c", "#3a6b5c"];

  function validateNewUser() {
    const e: Record<string, string> = {};
    if (!newUserForm.name.trim()) e.name = "El nombre es obligatorio";
    if (!newUserForm.email.trim() || !newUserForm.email.includes("@")) e.email = "Introduce un email válido";
    if (!newUserForm.password || newUserForm.password.length < 6) e.password = "Mínimo 6 caracteres";
    if (newUserForm.password !== newUserForm.confirmPassword) e.confirmPassword = "Las contraseñas no coinciden";
    return e;
  }

  function handleCreateUser() {
    const e = validateNewUser();
    if (Object.keys(e).length > 0) { setNewUserErrors(e); return; }
    const usedColors = professionals.map((p) => p.color);
    const color = profColors.find((c) => !usedColors.includes(c)) ?? profColors[0];
    const p: Professional = {
      id: `prof${Date.now()}`,
      name: newUserForm.name.trim(),
      role: newUserForm.role,
      email: newUserForm.email.trim(),
      phone: newUserForm.phone.trim(),
      numColegiado: newUserForm.numColegiado.trim() || "—",
      active: true,
      color,
      joined: format(new Date(), "MMM yyyy", { locale: es }),
      password: newUserForm.password,
    };
    onAddProfessional(p);
    setNewUserSuccess(newUserForm.email.trim());
    setNewUserForm({ name: "", role: PROF_ROLES[0], email: "", phone: "", numColegiado: "", password: "", confirmPassword: "" });
    setNewUserErrors({});
    setShowNewUserForm(false);
  }

  function FieldErr({ msg }: { msg?: string }) {
    if (!msg) return null;
    return <p className="text-xs mt-1" style={{ color: "#c0392b" }}>{msg}</p>;
  }

  const nonAdminProfs = professionals.filter((p) => !p.isAdmin);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: "'Didact Gothic', sans-serif", color: "#1c2d32" }}>
          Configuración
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "#6b7c80" }}>Preferencias generales de la aplicación</p>
      </div>

      {/* ── Admin: user management ─────────────────────────────── */}
      {isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold" style={{ color: "#1c2d32" }}>Gestión de usuarios</h2>
              <p className="text-xs mt-0.5" style={{ color: "#6b7c80" }}>
                Crea perfiles profesionales con acceso a la aplicación
              </p>
            </div>
            <button
              onClick={() => { setShowNewUserForm((v) => !v); setNewUserSuccess(null); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: "#1a5c58" }}>
              <Plus size={13} />
              Nuevo profesional
            </button>
          </div>

          {/* Success banner */}
          {newUserSuccess && (
            <div className="flex items-start gap-3 p-4 rounded-xl border"
              style={{ backgroundColor: "#e3eeec", borderColor: "#1a5c58" }}>
              <CheckCircle2 size={16} style={{ color: "#1a5c58", flexShrink: 0, marginTop: 1 }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "#1a5c58" }}>Perfil creado correctamente</p>
                <p className="text-xs mt-0.5" style={{ color: "#1c2d32" }}>
                  Se ha enviado un correo de confirmación de acceso a <strong>{newUserSuccess}</strong> con sus credenciales.
                </p>
              </div>
            </div>
          )}

          {/* New user form */}
          {showNewUserForm && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#6b7c80" }}>
                Datos del nuevo profesional
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>
                    Nombre completo <span style={{ color: "#c0392b" }}>*</span>
                  </label>
                  <input value={newUserForm.name}
                    onChange={(e) => setNewUserForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Nombre y apellidos"
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ borderColor: newUserErrors.name ? "#c0392b" : "rgba(28,45,50,0.12)", color: "#1c2d32" }} />
                  <FieldErr msg={newUserErrors.name} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>Especialidad / Rol</label>
                  <select value={newUserForm.role}
                    onChange={(e) => setNewUserForm((f) => ({ ...f, role: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background"
                    style={{ color: "#1c2d32" }}>
                    {PROF_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>N° Colegiado</label>
                  <input value={newUserForm.numColegiado}
                    onChange={(e) => setNewUserForm((f) => ({ ...f, numColegiado: e.target.value }))}
                    placeholder="XX-FT-0000"
                    className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background"
                    style={{ color: "#1c2d32" }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>
                    Email <span style={{ color: "#c0392b" }}>*</span>
                  </label>
                  <input type="email" value={newUserForm.email}
                    onChange={(e) => setNewUserForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="nombre@domusges.es"
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ borderColor: newUserErrors.email ? "#c0392b" : "rgba(28,45,50,0.12)", color: "#1c2d32" }} />
                  <FieldErr msg={newUserErrors.email} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>Teléfono</label>
                  <input value={newUserForm.phone}
                    onChange={(e) => setNewUserForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="6XX XXX XXX"
                    className="w-full px-3 py-2 rounded-lg text-sm border border-border bg-background"
                    style={{ color: "#1c2d32" }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>
                    Contraseña <span style={{ color: "#c0392b" }}>*</span>
                  </label>
                  <div className="relative">
                    <input type={showPw ? "text" : "password"} value={newUserForm.password}
                      onChange={(e) => setNewUserForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full px-3 py-2 pr-9 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-primary/30"
                      style={{ borderColor: newUserErrors.password ? "#c0392b" : "rgba(28,45,50,0.12)", color: "#1c2d32" }} />
                    <button type="button" onClick={() => setShowPw((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ color: "#6b7c80" }}>
                      {showPw ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                  <FieldErr msg={newUserErrors.password} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: "#6b7c80" }}>
                    Confirmar contraseña <span style={{ color: "#c0392b" }}>*</span>
                  </label>
                  <input type="password" value={newUserForm.confirmPassword}
                    onChange={(e) => setNewUserForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                    placeholder="Repite la contraseña"
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none focus:ring-2 focus:ring-primary/30"
                    style={{ borderColor: newUserErrors.confirmPassword ? "#c0392b" : "rgba(28,45,50,0.12)", color: "#1c2d32" }} />
                  <FieldErr msg={newUserErrors.confirmPassword} />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-border text-xs" style={{ color: "#6b7c80" }}>
                <Mail size={12} />
                Se enviará un correo de confirmación de acceso al email indicado
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreateUser}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-white"
                  style={{ backgroundColor: "#1a5c58" }}>
                  Crear perfil y enviar acceso
                </button>
                <button onClick={() => { setShowNewUserForm(false); setNewUserErrors({}); }}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-border"
                  style={{ color: "#6b7c80" }}>
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Existing professionals list */}
          <div className="space-y-2">
            {nonAdminProfs.map((prof) => (
              <div key={prof.id} className="bg-card rounded-xl border border-border px-4 py-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0"
                  style={{ backgroundColor: prof.color }}>
                  {getInitials(prof.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold" style={{ color: "#1c2d32" }}>{prof.name}</p>
                    <span className="text-xs px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: prof.active ? "#e3eeec" : "#f5f5f5", color: prof.active ? "#1a5c58" : "#999" }}>
                      {prof.active ? "Activo" : "Inactivo"}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "#6b7c80" }}>
                    {prof.role} · <span style={{ fontFamily: "'DM Mono', monospace" }}>{prof.email}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Toggle active */}
                  <button
                    onClick={() => onUpdateProfessional({ ...prof, active: !prof.active })}
                    className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                    title={prof.active ? "Desactivar acceso" : "Activar acceso"}
                    style={{ color: "#6b7c80" }}>
                    {prof.active ? <ToggleRight size={16} style={{ color: "#1a5c58" }} /> : <ToggleLeft size={16} />}
                  </button>
                  {/* Reset password */}
                  <button
                    onClick={() => setResetSentFor(prof.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-border hover:bg-muted/30 transition-colors"
                    style={{ color: "#6b7c80" }}>
                    <KeyRound size={11} />
                    Resetear
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Reset password confirmation toast */}
          {resetSentFor && (
            <div className="flex items-start gap-3 p-4 rounded-xl border"
              style={{ backgroundColor: "#fdf0e3", borderColor: "#c17f3a" }}>
              <Mail size={15} style={{ color: "#a0621a", flexShrink: 0, marginTop: 1 }} />
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: "#a0621a" }}>Correo de restablecimiento enviado</p>
                <p className="text-xs mt-0.5" style={{ color: "#1c2d32" }}>
                  Se ha enviado un enlace de restablecimiento de contraseña a{" "}
                  <strong>{professionals.find((p) => p.id === resetSentFor)?.email}</strong>
                </p>
              </div>
              <button onClick={() => setResetSentFor(null)} style={{ color: "#a0621a" }}>
                <X size={14} />
              </button>
            </div>
          )}

          <div style={{ borderTop: "1px solid rgba(28,45,50,0.08)" }} />
        </div>
      )}

      {/* ── General settings ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4">
        {[
          { label: "Notificaciones", desc: "Avisos de visitas, recordatorios y alertas del equipo", soon: true },
          { label: "Exportación de datos", desc: "Descarga informes en PDF, Excel o CSV", soon: true },
          { label: "Idioma y región", desc: "Español (España) · Zona horaria Europe/Madrid", soon: false },
          { label: "Accesibilidad", desc: "Tamaño de texto, contraste y preferencias visuales", soon: true },
        ].map(({ label, desc, soon }) => (
          <div key={label} className="bg-card rounded-xl border border-border px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: "#1c2d32" }}>{label}</p>
              <p className="text-xs mt-0.5" style={{ color: "#6b7c80" }}>{desc}</p>
            </div>
            {soon && (
              <span className="text-xs px-2.5 py-1 rounded-full flex-shrink-0"
                style={{ backgroundColor: "#e9e5de", color: "#6b7c80" }}>
                Próximamente
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="bg-card rounded-xl border border-border px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#6b7c80" }}>Versión</p>
        <p className="text-sm" style={{ color: "#1c2d32", fontFamily: "'DM Mono', monospace" }}>
          GID v0.1.0 — Gestión de pacientes de atención domiciliaria
        </p>
        <p className="text-xs mt-1" style={{ color: "#b0bec5" }}>
          Diseñada para Terapia Ocupacional, Fisioterapia, Psicología y disciplinas afines.
        </p>
      </div>
    </div>
  );
}


// ─── Calendar ────────────────────────────────────────────────────────────────

interface Appointment {
  id: string;
  patientId: string;
  professionalId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  duration: number; // minutes
  type: "Primera visita" | "Seguimiento" | "Evaluación" | "Alta";
}

const appointmentsData: Appointment[] = [
  // María / Ana (Fisio) — Thursdays
  { id: "a1",  patientId: "p1", professionalId: "prof1", date: "2026-06-05", time: "10:30", duration: 45, type: "Seguimiento" },
  { id: "a2",  patientId: "p1", professionalId: "prof1", date: "2026-06-12", time: "10:30", duration: 45, type: "Seguimiento" },
  { id: "a3",  patientId: "p1", professionalId: "prof1", date: "2026-06-19", time: "10:30", duration: 60, type: "Evaluación" },
  { id: "a4",  patientId: "p1", professionalId: "prof1", date: "2026-06-26", time: "10:30", duration: 45, type: "Seguimiento" },
  { id: "a5",  patientId: "p1", professionalId: "prof1", date: "2026-05-29", time: "10:30", duration: 45, type: "Seguimiento" },
  // José / Carlos (Psico) — Fridays
  { id: "a6",  patientId: "p2", professionalId: "prof2", date: "2026-06-06", time: "11:00", duration: 60, type: "Seguimiento" },
  { id: "a7",  patientId: "p2", professionalId: "prof2", date: "2026-06-13", time: "11:00", duration: 60, type: "Seguimiento" },
  { id: "a8",  patientId: "p2", professionalId: "prof2", date: "2026-06-20", time: "11:00", duration: 60, type: "Evaluación" },
  { id: "a9",  patientId: "p2", professionalId: "prof2", date: "2026-06-27", time: "11:00", duration: 60, type: "Seguimiento" },
  { id: "a10", patientId: "p2", professionalId: "prof2", date: "2026-05-30", time: "11:00", duration: 60, type: "Seguimiento" },
  // Carmen / Laura (TO) — Thursdays pm
  { id: "a11", patientId: "p3", professionalId: "prof3", date: "2026-06-05", time: "16:00", duration: 60, type: "Seguimiento" },
  { id: "a12", patientId: "p3", professionalId: "prof3", date: "2026-06-12", time: "16:00", duration: 60, type: "Seguimiento" },
  { id: "a13", patientId: "p3", professionalId: "prof3", date: "2026-06-19", time: "15:00", duration: 90, type: "Evaluación" },
  { id: "a14", patientId: "p3", professionalId: "prof3", date: "2026-06-26", time: "16:00", duration: 60, type: "Seguimiento" },
  { id: "a15", patientId: "p3", professionalId: "prof3", date: "2026-05-29", time: "16:00", duration: 60, type: "Seguimiento" },
  // Antonio / Ana (Fisio) — Saturdays
  { id: "a16", patientId: "p4", professionalId: "prof1", date: "2026-06-06", time: "09:00", duration: 60, type: "Seguimiento" },
  { id: "a17", patientId: "p4", professionalId: "prof1", date: "2026-06-13", time: "09:00", duration: 60, type: "Seguimiento" },
  { id: "a18", patientId: "p4", professionalId: "prof1", date: "2026-06-20", time: "09:00", duration: 60, type: "Seguimiento" },
  { id: "a19", patientId: "p4", professionalId: "prof1", date: "2026-05-30", time: "09:00", duration: 60, type: "Seguimiento" },
  // Lucía / Carlos (Psico) — Thursdays midday
  { id: "a20", patientId: "p5", professionalId: "prof2", date: "2026-06-05", time: "12:00", duration: 50, type: "Seguimiento" },
  { id: "a21", patientId: "p5", professionalId: "prof2", date: "2026-06-12", time: "12:00", duration: 50, type: "Seguimiento" },
  { id: "a22", patientId: "p5", professionalId: "prof2", date: "2026-06-19", time: "12:00", duration: 50, type: "Seguimiento" },
  { id: "a23", patientId: "p5", professionalId: "prof2", date: "2026-06-26", time: "12:00", duration: 50, type: "Seguimiento" },
  { id: "a24", patientId: "p5", professionalId: "prof2", date: "2026-05-29", time: "12:00", duration: 50, type: "Seguimiento" },
  // Manuel / Laura (TO) — Sundays
  { id: "a25", patientId: "p6", professionalId: "prof3", date: "2026-06-07", time: "10:00", duration: 60, type: "Seguimiento" },
  { id: "a26", patientId: "p6", professionalId: "prof3", date: "2026-06-14", time: "10:00", duration: 60, type: "Seguimiento" },
  { id: "a27", patientId: "p6", professionalId: "prof3", date: "2026-06-21", time: "10:00", duration: 60, type: "Seguimiento" },
  { id: "a28", patientId: "p6", professionalId: "prof3", date: "2026-06-28", time: "10:00", duration: 60, type: "Seguimiento" },
  { id: "a29", patientId: "p6", professionalId: "prof3", date: "2026-05-31", time: "10:00", duration: 60, type: "Seguimiento" },
  // Extra — primera visita for new patient slots
  { id: "a30", patientId: "p4", professionalId: "prof1", date: "2026-06-09", time: "09:00", duration: 60, type: "Seguimiento" },
  { id: "a31", patientId: "p1", professionalId: "prof1", date: "2026-07-03", time: "10:30", duration: 45, type: "Seguimiento" },
  { id: "a32", patientId: "p3", professionalId: "prof3", date: "2026-07-03", time: "16:00", duration: 60, type: "Seguimiento" },
];

// ─── Today / Route Map ───────────────────────────────────────────────────────

const PATIENT_COORDS: Record<string, [number, number]> = {
  p1: [42.8195, -1.6428],  // Calle Estafeta — Casco Viejo
  p2: [42.8124, -1.6499],  // Av. Carlos III — Ensanche
  p3: [42.8241, -1.6388],  // C/ Navas de Tolosa — Rochapea
  p4: [42.8063, -1.6522],  // Calle Aoiz — Milagrosa
  p5: [42.8112, -1.6597],  // C/ Marcelo Celayeta — San Jorge
  p6: [42.8275, -1.6320],  // Calle Leyre — Txantrea
};

function TodayView({ patients, professionals, loggedInProfId }: {
  patients: Patient[];
  professionals: Professional[];
  loggedInProfId: string | null;
}) {
  const TODAY = "2026-06-05";
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const loggedInIsAdmin = professionals.length === 0 || !professionals.find((p) => p.id === loggedInProfId);
  const [filterProfId, setFilterProfId] = useState<string>(
    loggedInIsAdmin ? "all" : (loggedInProfId ?? "all")
  );

  const allTodayApts = appointmentsData
    .filter((a) => a.date === TODAY)
    .sort((a, b) => a.time.localeCompare(b.time));

  const todayApts = filterProfId === "all"
    ? allTodayApts
    : allTodayApts.filter((a) => a.professionalId === filterProfId);

  const PAMPLONA_CENTER: [number, number] = [42.8169, -1.6432];

  useEffect(() => {
    if (!mapRef.current) return;
    if (leafletMap.current) { leafletMap.current.remove(); leafletMap.current = null; markersRef.current = {}; }

    const map = L.map(mapRef.current, {
      center: PAMPLONA_CENTER,
      zoom: 14,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    const routeCoords = todayApts
      .map((a) => PATIENT_COORDS[a.patientId])
      .filter(Boolean) as [number, number][];
    if (routeCoords.length > 1) {
      L.polyline(routeCoords, {
        color: "#1a5c58",
        weight: 3,
        opacity: 0.6,
        dashArray: "8 6",
      }).addTo(map);
    }

    todayApts.forEach((apt, idx) => {
      const patient = patients.find((p) => p.id === apt.patientId);
      const coords = PATIENT_COORDS[apt.patientId];
      if (!patient || !coords) return;

      const prof = professionals.find((p) => p.id === apt.professionalId);
      const initials = patient.name.split(" ").slice(0, 2).map((w) => w[0]).join("");

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:40px;height:40px;border-radius:50%;background:${patient.color};border:3px solid white;box-shadow:0 3px 10px rgba(0,0,0,0.28);display:flex;align-items:center;justify-content:center;color:white;font-size:13px;font-weight:700;font-family:'DM Mono',monospace;cursor:pointer;position:relative;">${idx + 1}<span style="position:absolute;bottom:-4px;right:-4px;width:16px;height:16px;border-radius:50%;background:white;border:1.5px solid ${patient.color};display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:${patient.color};">${initials}</span></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
        popupAnchor: [0, -24],
      });

      const marker = L.marker(coords, { icon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:200px;padding:2px 0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="width:8px;height:8px;border-radius:50%;background:${patient.color};flex-shrink:0"></div>
            <strong style="font-size:13px;color:#1c2d32">${patient.name}</strong>
          </div>
          <div style="font-size:11px;color:#6b7c80;margin-bottom:4px">
            🕐 <strong style="color:#1c2d32">${apt.time}</strong> · ${apt.duration} min · ${apt.type}
          </div>
          <div style="font-size:11px;color:#6b7c80;margin-bottom:4px">📍 ${patient.address}</div>
          <div style="font-size:11px;color:#6b7c80;margin-bottom:4px">📞 ${patient.phone}</div>
          ${prof ? `<div style="font-size:11px;color:#6b7c80">👤 ${prof.name}</div>` : ""}
        </div>
      `, { maxWidth: 260 });

      markersRef.current[apt.patientId] = marker;
    });

    leafletMap.current = map;
    return () => { map.remove(); leafletMap.current = null; markersRef.current = {}; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterProfId]);

  function focusMarker(patientId: string) {
    setActiveId(patientId);
    const marker = markersRef.current[patientId];
    const coords = PATIENT_COORDS[patientId];
    if (marker && leafletMap.current && coords) {
      leafletMap.current.setView(coords as L.LatLngExpression, 16, { animate: true });
      marker.openPopup();
    }
  }

  const SPECIALTY_LABELS: Record<string, string> = {
    "Fisioterapia": "Fisio", "Psicología": "Psico", "T. Ocupacional": "T.O.",
  };

  const professionalsWithApts = professionals.filter((p) =>
    allTodayApts.some((a) => a.professionalId === p.id)
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: "'Fraunces', serif", color: "#1c2d32" }}>
            Hoy
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#6b7c80" }}>
            Viernes, 5 de junio de 2026 · {todayApts.length} {todayApts.length === 1 ? "visita" : "visitas"} domiciliarias
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg"
          style={{ backgroundColor: "#e3eeec", color: "#1a5c58" }}>
          <Navigation2 size={13} />
          Comarca de Pamplona
        </div>
      </div>

      {/* Professional filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium" style={{ color: "#6b7c80" }}>Ver recorrido de:</span>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => { setFilterProfId("all"); setActiveId(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
            style={filterProfId === "all"
              ? { backgroundColor: "#1c2d32", color: "#fff", borderColor: "#1c2d32" }
              : { backgroundColor: "transparent", color: "#6b7c80", borderColor: "rgba(28,45,50,0.15)" }
            }>
            Todos ({allTodayApts.length})
          </button>
          {professionalsWithApts.map((prof) => {
            const count = allTodayApts.filter((a) => a.professionalId === prof.id).length;
            const isSelected = filterProfId === prof.id;
            return (
              <button
                key={prof.id}
                onClick={() => { setFilterProfId(prof.id); setActiveId(null); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
                style={isSelected
                  ? { backgroundColor: prof.color, color: "#fff", borderColor: prof.color }
                  : { backgroundColor: "transparent", color: "#6b7c80", borderColor: "rgba(28,45,50,0.15)" }
                }>
                <div className="w-4 h-4 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.3)" : prof.color, fontSize: 8 }}>
                  {getInitials(prof.name).slice(0, 1)}
                </div>
                {prof.name.split(" ")[0]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {todayApts.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-border">
          <Navigation2 size={32} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium" style={{ color: "#1c2d32" }}>Sin visitas hoy</p>
          <p className="text-xs mt-1" style={{ color: "#6b7c80" }}>No hay visitas programadas para este día</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: 560 }}>
          {/* Visit list */}
          <div className="lg:w-80 flex-shrink-0 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "#6b7c80" }}>
              Recorrido del día
            </p>
            {todayApts.map((apt, idx) => {
              const patient = patients.find((p) => p.id === apt.patientId);
              const prof = professionals.find((p) => p.id === apt.professionalId);
              if (!patient) return null;
              const isActive = activeId === apt.patientId;
              return (
                <button key={apt.id} onClick={() => focusMarker(apt.patientId)}
                  className="w-full text-left rounded-xl border p-4 transition-all hover:shadow-md"
                  style={{
                    backgroundColor: isActive ? `${patient.color}0d` : "#fff",
                    borderColor: isActive ? patient.color : "rgba(28,45,50,0.12)",
                  }}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white"
                      style={{ backgroundColor: patient.color }}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold truncate" style={{ color: "#1c2d32" }}>
                          {patient.name.split(" ").slice(0, 2).join(" ")}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
                          style={{ backgroundColor: `${patient.color}18`, color: patient.color }}>
                          {SPECIALTY_LABELS[patient.specialty]}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Clock size={11} style={{ color: "#6b7c80" }} />
                        <span className="text-xs font-medium" style={{ color: "#1c2d32", fontFamily: "'DM Mono', monospace" }}>
                          {apt.time}
                        </span>
                        <span className="text-xs" style={{ color: "#6b7c80" }}>· {apt.duration} min</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <MapPin size={10} className="mt-0.5 flex-shrink-0" style={{ color: "#6b7c80" }} />
                        <span className="text-xs leading-tight" style={{ color: "#6b7c80" }}>{patient.address}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Phone size={10} style={{ color: "#6b7c80" }} />
                        <span className="text-xs" style={{ color: "#6b7c80", fontFamily: "'DM Mono', monospace" }}>
                          {patient.phone}
                        </span>
                      </div>
                      {prof && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <User size={10} style={{ color: "#6b7c80" }} />
                          <span className="text-xs" style={{ color: "#6b7c80" }}>{prof.name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
            <div className="rounded-xl p-3 mt-2" style={{ backgroundColor: "rgba(26,92,88,0.06)" }}>
              <p className="text-xs font-semibold mb-1" style={{ color: "#1a5c58" }}>Resumen del recorrido</p>
              <p className="text-xs" style={{ color: "#6b7c80" }}>
                {todayApts.length} paradas · Comarca de Pamplona
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#6b7c80" }}>
                {todayApts[0]?.time} → {todayApts[todayApts.length - 1]?.time}
              </p>
            </div>
          </div>

          {/* Map */}
          <div className="flex-1 rounded-xl overflow-hidden border border-border" style={{ minHeight: 480 }}>
            <div ref={mapRef} style={{ width: "100%", height: "100%", minHeight: 480 }} />
          </div>
        </div>
      )}
    </div>
  );
}

type CalViewType = "month" | "week" | "day";

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function CalendarView({ professionals, patients, onSelectPatient }: {
  professionals: Professional[];
  patients: Patient[];
  onSelectPatient: (id: string) => void;
}) {
  const [calView, setCalView] = useState<CalViewType>("month");
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 5));
  const [filterProfId, setFilterProfId] = useState("all");
  const [filterPatientId, setFilterPatientId] = useState("all");
  const [filterSpecialty, setFilterSpecialty] = useState("all");
  const [selectedApt, setSelectedApt] = useState<Appointment | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>(appointmentsData);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [dragOverTime, setDragOverTime] = useState<string | null>(null);

  const TODAY = new Date(2026, 5, 5);
  const HOUR_START = 8;
  const HOUR_END = 20;
  const HOUR_HEIGHT = 64;
  const PX_PER_MIN = HOUR_HEIGHT / 60;
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

  const filteredApts = appointments.filter(apt => {
    if (filterProfId !== "all" && apt.professionalId !== filterProfId) return false;
    if (filterPatientId !== "all" && apt.patientId !== filterPatientId) return false;
    if (filterSpecialty !== "all") {
      const pat = patients.find(p => p.id === apt.patientId);
      if (pat?.specialty !== filterSpecialty) return false;
    }
    return true;
  });

  const periodCount = (() => {
    if (calView === "month") {
      const ms = format(startOfMonth(currentDate), "yyyy-MM-dd");
      const me = format(endOfMonth(currentDate), "yyyy-MM-dd");
      return filteredApts.filter(a => a.date >= ms && a.date <= me).length;
    }
    if (calView === "week") {
      const ws = format(startOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const we = format(endOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
      return filteredApts.filter(a => a.date >= ws && a.date <= we).length;
    }
    const ds = format(currentDate, "yyyy-MM-dd");
    return filteredApts.filter(a => a.date === ds).length;
  })();

  function navigate(dir: -1 | 1) {
    if (calView === "month") setCurrentDate(d => addMonths(d, dir));
    else if (calView === "week") setCurrentDate(d => addWeeks(d, dir));
    else setCurrentDate(d => addDays(d, dir));
  }

  function moveAppointment(aptId: string, newDate: string, newTime?: string) {
    setAppointments(prev => prev.map(a =>
      a.id === aptId ? { ...a, date: newDate, time: newTime ?? a.time } : a
    ));
    setDraggingId(null);
    setDragOverDate(null);
    setDragOverTime(null);
  }

  function calcDropTime(clientY: number, colEl: HTMLElement): string {
    const rect = colEl.getBoundingClientRect();
    const relY = clientY - rect.top;
    const rawMins = HOUR_START * 60 + relY / PX_PER_MIN;
    const snapped = Math.round(rawMins / 15) * 15;
    const clamped = Math.max(HOUR_START * 60, Math.min((HOUR_END - 0.5) * 60, snapped));
    const hh = Math.floor(clamped / 60);
    const mm = clamped % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }

  function getPeriodLabel() {
    if (calView === "month") return format(currentDate, "MMMM yyyy", { locale: es });
    if (calView === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
      const we = endOfWeek(currentDate, { weekStartsOn: 1 });
      if (isSameMonth(ws, we))
        return `${format(ws, "d")} – ${format(we, "d 'de' MMMM yyyy", { locale: es })}`;
      return `${format(ws, "d MMM", { locale: es })} – ${format(we, "d MMM yyyy", { locale: es })}`;
    }
    return format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: es });
  }

  function getPatient(patientId: string) { return patients.find(p => p.id === patientId); }
  function getProf(profId: string) { return professionals.find(p => p.id === profId); }
  function getColor(apt: Appointment) { return getPatient(apt.patientId)?.color ?? "#6b7c80"; }
  function getDayApts(dateStr: string) {
    return filteredApts.filter(a => a.date === dateStr).sort((a, b) => a.time.localeCompare(b.time));
  }

  const APT_TYPE_COLORS: Record<string, string> = {
    "Primera visita": "#5b3fa0",
    "Seguimiento": "#1a5c58",
    "Evaluación": "#c17f3a",
    "Alta": "#2a6b3f",
  };

  // ── Month view ──────────────────────────────────────────────────────────────
  const monthGrid = (() => {
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    const gridStart = startOfWeek(ms, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(me, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
    const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

    return (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-7" style={{ borderBottom: "1px solid rgba(28,45,50,0.08)", backgroundColor: "#faf9f7" }}>
          {DOW.map(d => (
            <div key={d} className="py-2.5 text-center text-xs font-semibold uppercase tracking-wide"
              style={{ color: "#6b7c80" }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map(day => {
            const ds = format(day, "yyyy-MM-dd");
            const apts = getDayApts(ds);
            const isToday = isSameDay(day, TODAY);
            const inMonth = isSameMonth(day, currentDate);
            const maxShow = 3;
            const overflow = apts.length - maxShow;
            return (
              <div
                key={ds}
                onClick={() => { if (!draggingId) { setCurrentDate(day); setCalView("day"); } }}
                onDragOver={e => { e.preventDefault(); setDragOverDate(ds); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDate(null); }}
                onDrop={e => {
                  e.preventDefault();
                  const aptId = e.dataTransfer.getData("aptId");
                  if (aptId) moveAppointment(aptId, ds);
                }}
                className="p-1.5 cursor-pointer transition-colors"
                style={{
                  minHeight: 88,
                  opacity: inMonth ? 1 : 0.35,
                  borderRight: "1px solid rgba(28,45,50,0.07)",
                  borderBottom: "1px solid rgba(28,45,50,0.07)",
                  backgroundColor: draggingId && dragOverDate === ds ? "rgba(26,92,88,0.07)" : undefined,
                  outline: draggingId && dragOverDate === ds ? "2px solid #1a5c58" : "none",
                  outlineOffset: -2,
                }}
              >
                <div className="mb-1 flex justify-between items-start">
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs"
                    style={isToday
                      ? { backgroundColor: "#1a5c58", color: "#fff", fontWeight: 700 }
                      : { color: "#1c2d32", fontWeight: 400 }
                    }
                  >
                    {format(day, "d")}
                  </span>
                  {apts.length > 0 && inMonth && (
                    <span className="text-xs px-1 rounded-full" style={{ backgroundColor: "#e3eeec", color: "#1a5c58", fontSize: 10 }}>
                      {apts.length}
                    </span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {apts.slice(0, maxShow).map(apt => {
                    const color = getColor(apt);
                    const pat = getPatient(apt.patientId);
                    return (
                      <button
                        key={apt.id}
                        draggable
                        onDragStart={e => {
                          e.stopPropagation();
                          setDraggingId(apt.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("aptId", apt.id);
                        }}
                        onDragEnd={() => { setDraggingId(null); setDragOverDate(null); }}
                        onClick={e => { e.stopPropagation(); if (!draggingId) setSelectedApt(selectedApt?.id === apt.id ? null : apt); }}
                        className="w-full flex items-center gap-1 px-1 py-0.5 rounded text-left transition-all cursor-grab active:cursor-grabbing"
                        style={{
                          backgroundColor: `${color}15`,
                          borderLeft: `2px solid ${color}`,
                          opacity: draggingId === apt.id ? 0.3 : 1,
                        }}
                      >
                        <span className="text-xs font-medium flex-shrink-0" style={{ color, fontFamily: "'DM Mono', monospace", fontSize: 10 }}>
                          {apt.time}
                        </span>
                        <span className="text-xs truncate hidden sm:inline" style={{ color, fontSize: 10 }}>
                          {pat?.name.split(" ")[0]}
                        </span>
                      </button>
                    );
                  })}
                  {overflow > 0 && (
                    <p className="text-xs px-1" style={{ color: "#6b7c80", fontSize: 10 }}>+{overflow} más</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  })();

  // ── Time grid (week + day) ──────────────────────────────────────────────────
  function renderTimeGrid(gridDays: Date[]) {
    const totalHeight = (HOUR_END - HOUR_START) * HOUR_HEIGHT;
    return (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* Day column headers */}
        <div className="flex" style={{ borderBottom: "1px solid rgba(28,45,50,0.08)", backgroundColor: "#faf9f7" }}>
          <div className="flex-shrink-0" style={{ width: 56 }} />
          {gridDays.map(day => {
            const isToday = isSameDay(day, TODAY);
            return (
              <div
                key={day.toISOString()}
                className="flex-1 py-3 text-center"
                style={{ borderLeft: "1px solid rgba(28,45,50,0.08)" }}
              >
                <p className="text-xs uppercase tracking-wide font-medium" style={{ color: "#6b7c80" }}>
                  {format(day, "EEE", { locale: es })}
                </p>
                <div
                  className="mx-auto mt-1 w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold"
                  style={isToday
                    ? { backgroundColor: "#1a5c58", color: "#fff" }
                    : { color: "#1c2d32" }
                  }
                >
                  {format(day, "d")}
                </div>
              </div>
            );
          })}
        </div>
        {/* Scrollable grid body */}
        <div className="overflow-y-auto" style={{ maxHeight: "62vh" }}>
          <div className="flex" style={{ height: totalHeight + 32 }}>
            {/* Hour gutter */}
            <div className="flex-shrink-0 relative" style={{ width: 56 }}>
              {hours.map(h => (
                <div
                  key={h}
                  className="absolute right-2"
                  style={{ top: (h - HOUR_START) * HOUR_HEIGHT + 4 }}
                >
                  <span className="text-xs" style={{ color: "#b0bec5", fontFamily: "'DM Mono', monospace" }}>
                    {String(h).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>
            {/* Day columns */}
            {gridDays.map(day => {
              const ds = format(day, "yyyy-MM-dd");
              const apts = getDayApts(ds);
              const isToday = isSameDay(day, TODAY);
              return (
                <div
                  key={ds}
                  className="flex-1 relative"
                  style={{
                    borderLeft: "1px solid rgba(28,45,50,0.08)",
                    backgroundColor: draggingId && dragOverDate === ds ? "rgba(26,92,88,0.04)" : undefined,
                  }}
                  onDragOver={e => {
                    e.preventDefault();
                    setDragOverDate(ds);
                    setDragOverTime(calcDropTime(e.clientY, e.currentTarget));
                  }}
                  onDragLeave={e => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverDate(null);
                      setDragOverTime(null);
                    }
                  }}
                  onDrop={e => {
                    e.preventDefault();
                    const aptId = e.dataTransfer.getData("aptId");
                    if (aptId) moveAppointment(aptId, ds, calcDropTime(e.clientY, e.currentTarget));
                  }}
                >
                  {/* Hour lines */}
                  {hours.map(h => (
                    <div
                      key={h}
                      className="absolute left-0 right-0"
                      style={{
                        top: (h - HOUR_START) * HOUR_HEIGHT,
                        height: HOUR_HEIGHT,
                        borderTop: `1px solid rgba(28,45,50,${h % 2 === 0 ? "0.07" : "0.03"})`,
                      }}
                    />
                  ))}
                  {/* Today tint */}
                  {isToday && (
                    <div className="absolute inset-0 pointer-events-none"
                      style={{ backgroundColor: "rgba(26,92,88,0.025)" }} />
                  )}
                  {/* Drop ghost preview */}
                  {draggingId && dragOverDate === ds && dragOverTime && (() => {
                    const dragApt = appointments.find(a => a.id === draggingId);
                    if (!dragApt) return null;
                    const [gh, gm] = dragOverTime.split(":").map(Number);
                    const gTop = (gh * 60 + gm - HOUR_START * 60) * PX_PER_MIN;
                    const gH = Math.max(dragApt.duration * PX_PER_MIN, 26);
                    const gc = getColor(dragApt);
                    return (
                      <div
                        className="absolute rounded-lg pointer-events-none flex items-start p-1.5"
                        style={{
                          top: gTop,
                          height: gH,
                          left: 2, right: 2,
                          backgroundColor: `${gc}22`,
                          border: `2px dashed ${gc}`,
                          zIndex: 30,
                        }}
                      >
                        <span className="text-xs font-semibold" style={{ color: gc, fontFamily: "'DM Mono', monospace" }}>
                          {dragOverTime}
                        </span>
                      </div>
                    );
                  })()}
                  {/* Events */}
                  {apts.map(apt => {
                    const [h, m] = apt.time.split(":").map(Number);
                    const topPx = (h * 60 + m - HOUR_START * 60) * PX_PER_MIN;
                    const heightPx = Math.max(apt.duration * PX_PER_MIN, 26);
                    const color = getColor(apt);
                    const pat = getPatient(apt.patientId);
                    const prof = getProf(apt.professionalId);
                    const isSel = selectedApt?.id === apt.id;
                    return (
                      <button
                        key={apt.id}
                        draggable
                        onDragStart={e => {
                          e.stopPropagation();
                          setDraggingId(apt.id);
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("aptId", apt.id);
                        }}
                        onDragEnd={() => { setDraggingId(null); setDragOverDate(null); setDragOverTime(null); }}
                        onClick={e => { e.stopPropagation(); if (!draggingId) setSelectedApt(isSel ? null : apt); }}
                        className="absolute rounded-lg p-2 text-left overflow-hidden transition-all hover:shadow-sm cursor-grab active:cursor-grabbing"
                        style={{
                          top: topPx + 1,
                          height: heightPx - 2,
                          left: 2,
                          right: 2,
                          backgroundColor: `${color}16`,
                          borderLeft: `3px solid ${color}`,
                          zIndex: isSel ? 10 : 2,
                          outline: isSel ? `2px solid ${color}` : "none",
                          outlineOffset: 1,
                          opacity: draggingId === apt.id ? 0.3 : 1,
                        }}
                      >
                        <p className="text-xs font-semibold leading-tight truncate" style={{ color }}>
                          {apt.time}{heightPx > 28 && ` · ${pat?.name.split(" ").slice(0, 2).join(" ")}`}
                        </p>
                        {heightPx > 44 && (
                          <p className="text-xs leading-tight truncate mt-0.5" style={{ color: `${color}bb` }}>
                            {prof?.name.split(" ")[0]} · {apt.type}
                          </p>
                        )}
                        {heightPx > 62 && (
                          <p className="text-xs leading-tight mt-0.5" style={{ color: `${color}77` }}>
                            {apt.duration} min
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const weekDays = (() => {
    const ws = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  })();

  // Selected event detail
  const selPat = selectedApt ? getPatient(selectedApt.patientId) : null;
  const selProf = selectedApt ? getProf(selectedApt.professionalId) : null;
  const selColor = selectedApt ? getColor(selectedApt) : "#6b7c80";
  const hasFilters = filterProfId !== "all" || filterPatientId !== "all" || filterSpecialty !== "all";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-semibold"
            style={{ fontFamily: "'Didact Gothic', sans-serif", color: "#1c2d32" }}>
            {capitalize(getPeriodLabel())}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#6b7c80" }}>
            {periodCount} cita{periodCount !== 1 ? "s" : ""} en este período
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap self-start">
          {/* View switcher */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["month", "week", "day"] as const).map((v, i) => (
              <button
                key={v}
                onClick={() => setCalView(v)}
                className="px-3 py-2 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: calView === v ? "#1a5c58" : "#fff",
                  color: calView === v ? "#fff" : "#6b7c80",
                  borderLeft: i > 0 ? "1px solid rgba(28,45,50,0.1)" : "none",
                }}
              >
                {v === "month" ? "Mes" : v === "week" ? "Semana" : "Día"}
              </button>
            ))}
          </div>
          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg border border-border hover:bg-muted/40 transition-colors"
              style={{ color: "#6b7c80" }}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => setCurrentDate(TODAY)}
              className="px-3 py-2 rounded-lg text-xs font-medium border border-border hover:bg-muted/40 transition-colors"
              style={{ color: "#1c2d32" }}
            >
              Hoy
            </button>
            <button
              onClick={() => navigate(1)}
              className="p-2 rounded-lg border border-border hover:bg-muted/40 transition-colors"
              style={{ color: "#6b7c80" }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center py-3 px-4 rounded-xl border border-border bg-card">
        <Filter size={13} style={{ color: "#b0bec5" }} />
        <select
          value={filterProfId}
          onChange={e => setFilterProfId(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs border border-border bg-background outline-none focus:ring-2 focus:ring-primary/20"
          style={{ color: "#1c2d32" }}
        >
          <option value="all">Todos los profesionales</option>
          {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select
          value={filterPatientId}
          onChange={e => setFilterPatientId(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-xs border border-border bg-background outline-none focus:ring-2 focus:ring-primary/20"
          style={{ color: "#1c2d32" }}
        >
          <option value="all">Todos los pacientes</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="flex gap-1.5">
          {(["Fisioterapia", "Psicología", "T. Ocupacional"] as Specialty[]).map(sp => {
            const st = specialtyStyle(sp);
            const active = filterSpecialty === sp;
            return (
              <button
                key={sp}
                onClick={() => setFilterSpecialty(active ? "all" : sp)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                style={active
                  ? { backgroundColor: st.dot, color: "#fff", borderColor: st.dot }
                  : { backgroundColor: st.bg, color: st.text, borderColor: "transparent" }
                }
              >
                {sp}
              </button>
            );
          })}
        </div>
        {hasFilters && (
          <button
            onClick={() => { setFilterProfId("all"); setFilterPatientId("all"); setFilterSpecialty("all"); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-border hover:bg-muted/40 transition-colors"
            style={{ color: "#6b7c80" }}
          >
            <X size={11} /> Limpiar
          </button>
        )}
      </div>

      {/* Selected event detail */}
      {selectedApt && selPat && (
        <div
          className="rounded-xl border p-4 flex items-start gap-3 transition-all"
          style={{ borderColor: `${selColor}40`, backgroundColor: `${selColor}08` }}
        >
          <Avatar name={selPat.name} color={selColor} size="sm" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <p className="text-sm font-semibold" style={{ color: "#1c2d32" }}>{selPat.name}</p>
              <SpecialtyBadge specialty={selPat.specialty} />
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${APT_TYPE_COLORS[selectedApt.type]}18`, color: APT_TYPE_COLORS[selectedApt.type] }}
              >
                {selectedApt.type}
              </span>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-1.5">
                <CalendarDays size={11} style={{ color: "#6b7c80" }} />
                <span className="text-xs" style={{ color: "#6b7c80", fontFamily: "'DM Mono', monospace" }}>
                  {capitalize(format(new Date(selectedApt.date + "T00:00"), "d 'de' MMMM yyyy", { locale: es }))}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={11} style={{ color: "#6b7c80" }} />
                <span className="text-xs" style={{ color: "#6b7c80", fontFamily: "'DM Mono', monospace" }}>
                  {selectedApt.time} · {selectedApt.duration} min
                </span>
              </div>
              {selProf && (
                <div className="flex items-center gap-1.5">
                  <User size={11} style={{ color: "#6b7c80" }} />
                  <span className="text-xs" style={{ color: "#6b7c80" }}>
                    {selProf.name} · {selProf.role}
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => onSelectPatient(selPat.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-muted/40 transition-colors"
              style={{ color: "#1c2d32" }}
            >
              Ver paciente
            </button>
            <button
              onClick={() => setSelectedApt(null)}
              className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <X size={13} style={{ color: "#6b7c80" }} />
            </button>
          </div>
        </div>
      )}

      {/* Calendar body */}
      {calView === "month" && monthGrid}
      {calView === "week" && renderTimeGrid(weekDays)}
      {calView === "day" && renderTimeGrid([currentDate])}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [loggedInProfId, setLoggedInProfId] = useState<string | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [newVisitPatientId, setNewVisitPatientId] = useState<string | undefined>(undefined);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [professionals, setProfessionals] = useState<Professional[]>(initialProfessionals);
  const [patientList, setPatientList] = useState<Patient[]>(patients);
  const [visitHistory, setVisitHistory] = useState<Record<string, Visit[]>>(visitsByPatient);
  const [assessmentHistory, setAssessmentHistory] = useState<Assessment[]>(seedAssessments);

  if (loggedInProfId === null) {
    return (
      <LoginView
        professionals={professionals}
        onLogin={(id) => {
          setLoggedInProfId(id);
          const prof = professionals.find((p) => p.id === id);
          setView(prof?.isAdmin ? "admin-users" : "today");
        }}
      />
    );
  }

  const loggedInProf = professionals.find((p) => p.id === loggedInProfId);
  const clinicalProfs = professionals.filter((p) => !p.isAdmin);

  function addVisit(v: Visit) {
    setVisitHistory(prev => ({
      ...prev,
      [v.patientId]: [v, ...(prev[v.patientId] ?? [])],
    }));
  }

  function addAssessment(a: Assessment) {
    setAssessmentHistory(prev => [...prev, a]);
  }

  function addProfessional(p: Professional) { setProfessionals(prev => [...prev, p]); }
  function updateProfessional(p: Professional) { setProfessionals(prev => prev.map(x => x.id === p.id ? p : x)); }
  function deleteProfessional(id: string) { setProfessionals(prev => prev.filter(x => x.id !== id)); }

  function addPatient(p: Patient) {
    setPatientList(prev => [...prev, p]);
    setSelectedPatientId(p.id);
    setView("patient-detail");
  }

  function navigateTo(v: View) { setView(v); setSidebarOpen(false); }

  function selectPatient(id: string) { setSelectedPatientId(id); setView("patient-detail"); }

  function openNewVisit(id?: string) { setNewVisitPatientId(id); setView("new-visit"); }

  function handleBack() {
    if (view === "new-visit" && selectedPatientId) {
      setView("patient-detail");
    } else if (view === "new-patient" || view === "patient-detail" || view === "new-visit") {
      setView("patients");
    } else {
      setView("dashboard");
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar active={view} onNavigate={navigateTo} open={sidebarOpen} onClose={() => setSidebarOpen(false)} loggedInProf={loggedInProf} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-5 py-3.5 bg-background flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(28,45,50,0.08)" }}>
          <button className="lg:hidden p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
            onClick={() => setSidebarOpen(true)}>
            <Menu size={18} style={{ color: "#6b7c80" }} />
          </button>
          <div className="hidden lg:flex items-center gap-1.5 text-xs"
            style={{ color: "#6b7c80", fontFamily: "'DM Mono', monospace" }}>
            <Home size={12} />
            <span>/</span>
            <span style={{ color: "#1c2d32" }}>
              {view === "dashboard" && "Inicio"}
              {view === "patients" && "Pacientes"}
              {view === "patient-detail" && patientList.find((p) => p.id === selectedPatientId)?.name}
              {view === "new-visit" && "Nueva visita"}
              {view === "new-patient" && "Nuevo paciente"}
              {view === "equipo" && "Equipo"}
              {view === "today" && "Hoy"}
              {view === "calendar" && "Agenda"}
              {view === "reports" && "Informes"}
              {view === "settings" && "Configuración"}
              {view === "admin-users" && "Gestión de usuarios"}
              {view === "facturacion" && "Facturación"}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button className="relative p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <Bell size={16} style={{ color: "#6b7c80" }} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: "#c17f3a" }} />
            </button>
            {loggedInProf && (
              <div className="flex items-center gap-2 pl-2 border-l border-border">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                  style={{ backgroundColor: loggedInProf.color }}>
                  {getInitials(loggedInProf.name)}
                </div>
                <span className="hidden sm:block text-xs font-medium" style={{ color: "#1c2d32" }}>
                  {loggedInProf.name.split(" ")[0]}
                </span>
                <button
                  onClick={() => setLoggedInProfId(null)}
                  className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
                  title="Cerrar sesión"
                  style={{ color: "#6b7c80" }}
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-7">
          {view === "dashboard" && (
            <Dashboard onSelectPatient={selectPatient} onNewVisit={() => openNewVisit()} />
          )}
          {view === "patients" && (
            <PatientList
              patients={patientList}
              onSelectPatient={selectPatient}
              onNewVisit={() => openNewVisit()}
              onNewPatient={() => setView("new-patient")}
            />
          )}
          {view === "patient-detail" && selectedPatientId && (
            <PatientDetail
              patientId={selectedPatientId}
              patients={patientList}
              visits={visitHistory[selectedPatientId] ?? []}
              assessments={assessmentHistory.filter((a) => a.patientId === selectedPatientId)}
              onAddAssessment={addAssessment}
              onBack={handleBack}
              onNewVisit={openNewVisit}
            />
          )}
          {view === "new-visit" && (
            <NewVisitForm
              preselectedId={newVisitPatientId}
              patients={patientList}
              onSave={addVisit}
              onBack={handleBack}
            />
          )}
          {view === "new-patient" && (
            <NewPatientForm
              professionals={clinicalProfs}
              onSave={addPatient}
              onBack={handleBack}
            />
          )}
          {view === "equipo" && (
            <TeamView
              professionals={clinicalProfs}
              patientList={patientList}
              onAdd={addProfessional}
              onUpdate={updateProfessional}
              onDelete={deleteProfessional}
              onSelectPatient={selectPatient}
            />
          )}
          {view === "settings" && (
            <SettingsView
              loggedInProfId={loggedInProfId}
              professionals={professionals}
              onAddProfessional={addProfessional}
              onUpdateProfessional={updateProfessional}
            />
          )}
          {view === "admin-users" && (
            <AdminUsersView
              professionals={professionals}
              onAddProfessional={addProfessional}
              onUpdateProfessional={updateProfessional}
            />
          )}
          {view === "today" && (
            <TodayView
              patients={patientList}
              professionals={clinicalProfs}
              loggedInProfId={loggedInProfId}
            />
          )}
          {view === "calendar" && (
            <CalendarView
              professionals={clinicalProfs}
              patients={patientList}
              onSelectPatient={selectPatient}
            />
          )}
          {view === "reports" && (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <FileText size={40} className="mb-4 opacity-20" />
              <h2 className="text-lg font-semibold mb-1" style={{ fontFamily: "'Fraunces', serif", color: "#1c2d32" }}>
                Informes
              </h2>
              <p className="text-sm" style={{ color: "#6b7c80" }}>Generación de informes próximamente</p>
            </div>
          )}
          {view === "facturacion" && (
            <BillingView
              professionals={clinicalProfs}
              patients={patientList}
              visitHistory={visitHistory}
              assessments={assessmentHistory}
            />
          )}
        </main>
      </div>
    </div>
  );
}
