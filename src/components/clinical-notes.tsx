"use client";

/**
 * ClinicalNotes — renders clinical note content.
 * Handles both HTML (from RichTextarea) and plain text (legacy).
 * USE THIS COMPONENT everywhere visit notes are displayed.
 */
export function ClinicalNotes({ html, className, lineClamp }: { html: string; className?: string; lineClamp?: number }) {
  if (!html || !html.trim()) return <p className="text-sm text-muted-foreground italic">Sin notas.</p>;
  // If the text has no HTML tags, it's legacy plain text — convert newlines to <br>
  const hasHtml = /<[a-z][\s\S]*>/i.test(html);
  const rendered = hasHtml ? html : html.replace(/\n/g, "<br>");
  return (
    <div
      className={`text-sm prose prose-sm max-w-none ${lineClamp ? `line-clamp-${lineClamp}` : ""} ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}
