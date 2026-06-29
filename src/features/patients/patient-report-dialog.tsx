"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { FileText, Download } from "lucide-react";

const SECTION_OPTIONS: { key: "summary" | "visits" | "assessments"; label: string }[] = [
  { key: "summary", label: "Resumen y datos del paciente" },
  { key: "visits", label: "Historial de seguimientos" },
  { key: "assessments", label: "Evaluaciones y escalas" },
];

export function PatientReportDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  patientId: string;
  patientName: string;
}) {
  const [sections, setSections] = useState<Set<string>>(
    new Set(["summary", "visits", "assessments"]),
  );
  const [format, setFormat] = useState<"word" | "pdf">("word");
  const [audience, setAudience] = useState<"professional" | "family">("professional");
  const [generating, setGenerating] = useState(false);

  function toggleSection(key: string) {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleGenerate() {
    if (sections.size === 0) {
      toast({ title: "Selecciona al menos una sección", variant: "destructive" });
      return;
    }
    setGenerating(true);
    try {
      const qs = new URLSearchParams({
        format,
        sections: Array.from(sections).join(","),
        audience,
      });
      const res = await fetch(`/api/patients/${patientId}/report?${qs.toString()}`);
      if (!res.ok) throw new Error("REPORT_ERROR");

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const fileName = match?.[1] ?? (format === "pdf" ? "Informe.pdf" : "Informe.docx");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast({ title: "Informe generado", description: `Se ha descargado el informe de ${patientName}.` });
      onOpenChange(false);
    } catch {
      toast({ title: "Error al generar el informe", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Generar informe</DialogTitle>
          <DialogDescription>{patientName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Destinatario
            </Label>
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant={audience === "professional" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setAudience("professional")}
              >
                Para profesional
              </Button>
              <Button
                type="button"
                variant={audience === "family" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setAudience("family")}
              >
                Para familia
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {audience === "professional"
                ? "Lenguaje clínico, con puntuaciones de escalas y alertas."
                : "Lenguaje claro, sin alertas ni puntuaciones técnicas."}
            </p>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">
              Secciones a incluir
            </Label>
            <div className="mt-2 space-y-2.5">
              {SECTION_OPTIONS.map((opt) => (
                <label key={opt.key} className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <Checkbox
                    checked={sections.has(opt.key)}
                    onCheckedChange={() => toggleSection(opt.key)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Formato</Label>
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant={format === "word" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setFormat("word")}
              >
                <FileText className="w-4 h-4 mr-1.5" />
                Word
              </Button>
              <Button
                type="button"
                variant={format === "pdf" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setFormat("pdf")}
              >
                <FileText className="w-4 h-4 mr-1.5" />
                PDF
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleGenerate} disabled={generating}>
            <Download className="w-4 h-4 mr-1.5" />
            {generating ? "Generando…" : "Descargar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
