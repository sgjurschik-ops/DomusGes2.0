"use client";

import { useState } from "react";
import { ListChecks, Plus, Trash2, Tag, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask, type TaskDTO } from "@/hooks/api";
import { cn } from "@/lib/utils";

// Etiquetas rápidas sugeridas — no son la única opción, se puede escribir
// cualquier otra etiqueta libre al crear la tarea.
const QUICK_TAGS = ["Urgente", "Hoy", "Recordar"];

function tagVariant(tag: string): "destructive" | "secondary" {
  return tag.toLowerCase() === "urgente" ? "destructive" : "secondary";
}

export function TasksPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: tasks } = useTasks();
  const create = useCreateTask();
  const update = useUpdateTask();
  const del = useDeleteTask();

  const [text, setText] = useState("");
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");

  const pending = (tasks ?? []).filter((t) => !t.done);
  const done = (tasks ?? []).filter((t) => t.done);

  function toggleDraftTag(tag: string) {
    setDraftTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function addCustomTag() {
    const t = customTag.trim();
    if (!t || draftTags.includes(t)) { setCustomTag(""); return; }
    setDraftTags((prev) => [...prev, t]);
    setCustomTag("");
  }

  async function handleAdd() {
    const t = text.trim();
    if (!t) return;
    await create.mutateAsync({ text: t, tags: draftTags });
    setText("");
    setDraftTags([]);
  }

  function toggleDone(task: TaskDTO) {
    update.mutate({ id: task.id, done: !task.done });
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:w-[420px] p-0 flex flex-col">
        <SheetHeader className="px-4 py-3 border-b flex-row items-center gap-2">
          <SheetTitle className="text-base flex-1">Tareas</SheetTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground" onClick={onClose} aria-label="Cerrar">
            ✕
          </Button>
        </SheetHeader>

        {/* Añadir tarea */}
        <div className="px-4 py-3 border-b space-y-2">
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="Nueva tarea…"
              className="flex-1"
            />
            <Button size="icon" onClick={handleAdd} disabled={!text.trim()} aria-label="Añadir tarea">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleDraftTag(tag)}
                className={cn(
                  "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                  draftTags.includes(tag)
                    ? "bg-foreground text-background border-foreground"
                    : "text-muted-foreground border-border hover:bg-muted",
                )}
              >
                {tag}
              </button>
            ))}
            <div className="flex items-center gap-1">
              <Tag className="w-3 h-3 text-muted-foreground" />
              <input
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomTag(); } }}
                placeholder="otra etiqueta…"
                className="text-[11px] w-24 bg-transparent border-b border-dashed border-border focus:outline-none focus:border-foreground"
              />
            </div>
            {draftTags.filter((t) => !QUICK_TAGS.includes(t)).map((t) => (
              <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-foreground text-background flex items-center gap-1">
                {t}
                <button type="button" onClick={() => toggleDraftTag(t)} aria-label={`Quitar etiqueta ${t}`}>
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Listado */}
        <div className="flex-1 overflow-y-auto">
          {pending.length === 0 && done.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
              <ListChecks className="w-8 h-8 opacity-40" />
              <p className="text-sm">Sin tareas pendientes</p>
            </div>
          ) : (
            <>
              <ul className="divide-y">
                {pending.map((task) => (
                  <li key={task.id} className="px-4 py-2.5 flex items-start gap-2.5 group">
                    <Checkbox checked={task.done} onCheckedChange={() => toggleDone(task)} className="mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{task.text}</p>
                      {task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {task.tags.map((tag) => (
                            <Badge key={tag} variant={tagVariant(tag)} className="text-[10px] px-1.5 py-0">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => del.mutate(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                      aria-label="Eliminar tarea"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>

              {done.length > 0 && (
                <div className="mt-2">
                  <p className="px-4 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground bg-muted/40">
                    Hechas ({done.length})
                  </p>
                  <ul className="divide-y">
                    {done.map((task) => (
                      <li key={task.id} className="px-4 py-2.5 flex items-start gap-2.5 group">
                        <Checkbox checked={task.done} onCheckedChange={() => toggleDone(task)} className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm line-through text-muted-foreground">{task.text}</p>
                          {task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {task.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0 opacity-60">{tag}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => del.mutate(task.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0"
                          aria-label="Eliminar tarea"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Icono con contador — para la cabecera ─────────────────────────────────
export function TasksTrigger() {
  const [open, setOpen] = useState(false);
  const { data: tasks } = useTasks();
  const pendingCount = (tasks ?? []).filter((t) => !t.done).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        aria-label={pendingCount > 0 ? `${pendingCount} tareas pendientes` : "Tareas"}
      >
        <ListChecks className="w-5 h-5" />
        {pendingCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {pendingCount > 99 ? "99+" : pendingCount}
          </span>
        )}
      </button>
      <TasksPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
