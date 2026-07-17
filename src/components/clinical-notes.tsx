"use client";

export function ClinicalNotes({ html, className, lineClamp }: { html: string; className?: string; lineClamp?: number }) {
  if (!html || !html.trim()) return <p className="text-sm text-muted-foreground italic">Sin notas.</p>;
  return <div className={`text-sm prose prose-sm max-w-none ${lineClamp ? `line-clamp-${lineClamp}` : ""} ${className ?? ""}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
