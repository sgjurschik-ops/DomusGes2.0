"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function OccupationalProfileTab({ patientId }: { patientId: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil ocupacional</CardTitle>
        <CardDescription>
          Registro estructurado del perfil ocupacional del paciente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Perfil ocupacional del paciente {patientId}. Próximo paso: formulario editable.
        </p>
      </CardContent>
    </Card>
  );
}