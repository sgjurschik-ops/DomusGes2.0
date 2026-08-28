"use client";

// Diálogo para exportar los seguimientos de uno/a o varios/as usuarios/as a un
// PDF imprimible. Reutiliza `openVisitsPrint` (src/lib/visits-export.ts). Es solo
// lectura: no modifica ningún dato.
//
// Los objetivos/GAS no se incluyen aquí (harían falta cargar los objetivos de
// cada usuario/a por separado); sí van en la exportación individual desde la
// pestaña de Seguimientos, donde esos datos ya están cargados. Notas, autor +
// profesión, intervenciones y tareas sí se exportan.

import { useMemo, useState } from "react";
import { usePatients, useProfessionals, fetcher } from "@/hooks/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, FileDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { openVisitsPrint, type ExportPatientGroup, type ExportVisit } from "@/lib/visits-export";

type VisitDTO = {
  therapistId: string;
  therapistName: string;
  date: string;
  durationMin: number;
  title: string | null;
  notes: string;
  interventions: string[];
  tasks: { id: string; text: string; completed: boolean }[];
};

export function VisitsExportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: patients } = usePatients();
  const { data: professionals } = useProfessionals();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const roleById = useMemo(
    () => new Map((professionals ?? []).map((p) => [p.id, p.role])),
    [professionals],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = patients ?? [];
    if (!q) return list;
    return list.filter((p) => p.fullName.toLowerCase().includes(q));
  }, [patients, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = filtered.every((p) => next.has(p.id));
      for (const p of filtered) {
        if (allSelected) next.delete(p.id);
        else next.add(p.id);
      }
      return next;
    });
  }

  async function handleExport() {
    if (selected.size === 0) return;
    setIsExporting(true);
    try {
      const chosen = (patients ?? []).filter((p) => selected.has(p.id));
      const groups: ExportPatientGroup[] = await Promise.all(
        chosen.map(async (p) => {
          const visits = await fetcher<VisitDTO[]>(`/api/visits?patientId=${p.id}`);
          const exportVisits: ExportVisit[] = (visits ?? []).map((v) => ({
            date: v.date,
            durationMin: v.durationMin,
            title: v.title,
            notes: v.notes,
            therapistName: v.therapistName,
            therapistRole: roleById.get(v.therapistId) ?? null,
            interventions: v.interventions,
            tasks: v.tasks,
          }));
          return { patientName: p.fullName, visits: exportVisits };
        }),
      );

      const title =
        groups.length === 1 ? groups[0].patientName : `${groups.length} usuarios/as`;
      const ok = openVisitsPrint(groups, { title });
      if (!ok) {
        toast({
          title: "Ventana bloqueada",
          description: "Permite las ventanas emergentes para este sitio y vuelve a intentarlo.",
          variant: "destructive",
        });
        return;
      }
      onOpenChange(false);
    } catch {
      toast({
        title: "Error al exportar",
        description: "No se han podido obtener los seguimientos. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Exportar seguimientos</DialogTitle>
          <DialogDescription>
            Elige uno/a o varios/as usuarios/as y genera un PDF imprimible con todos sus
            seguimientos. No modifica ningún dato.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar usuario/a…"
            className="pl-8 h-9"
          />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
          <button type="button" onClick={toggleAllFiltered} className="hover:text-foreground underline-offset-2 hover:underline">
            {allFilteredSelected ? "Quitar selección" : "Seleccionar todos"}
          </button>
          <span>{selected.size} seleccionado/s</span>
        </div>

        <div className="flex-1 overflow-y-auto -mx-1 px-1 divide-y rounded-lg border">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">Sin resultados.</p>
          ) : (
            filtered.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40"
              >
                <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                <span className="text-sm">{p.fullName}</span>
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleExport} disabled={selected.size === 0 || isExporting}>
            <FileDown className="w-4 h-4 mr-1.5" />
            {isExporting ? "Generando…" : `Exportar PDF (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
