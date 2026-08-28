"use client";

// Pestaña "Intervenciones": diario privado de cada profesional (notas + tareas).
// A diferencia de "Seguimientos" (compartidos), aquí cada profesional solo ve,
// crea, edita y borra LAS SUYAS. La privacidad se fuerza en el servidor
// (GET /api/visits?kind=intervencion filtra por el profesional de la sesión);
// este componente solo pinta lo que el servidor ya ha filtrado.
//
// Reutiliza el mismo formulario que los seguimientos (NewVisitForm) con
// kind="intervencion": muestra Tareas (con arrastre de pendientes) y oculta
// Objetivos/GAS e Intervenciones realizadas.

import { useState } from "react";
import { useVisits } from "@/hooks/api";
import { NewVisitForm } from "@/features/visits/new-visit-form";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClinicalNotes } from "@/components/clinical-notes";
import { formatDateTime } from "@/components/domain";
import { Plus, Pencil, ClipboardList, Lock } from "lucide-react";

export function InterventionsTab({
  patientId,
  patientName,
}: {
  patientId: string;
  patientName: string;
}) {
  const { data: visits } = useVisits(patientId, "intervencion");
  const [newOpen, setNewOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 shrink-0" />
          Privado: solo tú ves tus intervenciones.
        </p>
        <Button size="sm" className="h-8 text-xs px-3" onClick={() => setNewOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" />Registrar intervención
        </Button>
      </div>

      {!visits || visits.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No hay intervenciones registradas todavía.
        </Card>
      ) : (
        visits.map((v, idx) => (
          <Card
            key={v.id}
            className="overflow-hidden"
            style={{ borderLeftWidth: "4px", borderLeftColor: idx === 0 ? "var(--chip-blue-text)" : "var(--border)" }}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-sm font-semibold">{v.title ?? "Intervención"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(v.date)} · {v.durationMin} min · {v.therapistName}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={() => setOpenId(v.id)}>
                  <Pencil className="w-3 h-3 mr-1" /> Editar
                </Button>
              </div>
              <div className="rounded-md bg-muted/40 px-3 py-2">
                <ClinicalNotes html={v.notes} />
              </div>
              {(v.tasks ?? []).length > 0 && (
                <div className="mt-3 rounded-md border bg-accent/30 px-3 py-2 space-y-1.5">
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Tareas para la próxima sesión</p>
                  {v.tasks.map((t) => (
                    <div key={t.id} className={`flex items-center gap-2 text-sm ${t.completed ? "line-through text-muted-foreground" : ""}`}>
                      <span className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${t.completed ? "bg-green-100 border-green-400 text-green-600" : "border-muted-foreground/40"}`}>
                        {t.completed && <span className="text-xs font-bold">✓</span>}
                      </span>
                      <span className="font-medium">{t.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}

      <NewVisitForm
        open={newOpen || !!openId}
        patientId={patientId}
        patientName={patientName}
        kind="intervencion"
        previousVisit={visits?.[0]}
        editVisit={openId ? visits?.find((v) => v.id === openId) : undefined}
        onClose={() => {
          setNewOpen(false);
          setOpenId(null);
        }}
      />
    </div>
  );
}
