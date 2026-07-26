"use client";

import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Mail, Send, Trash2, ArrowLeft, Pencil, Inbox, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useMessages, useSendMessage, useMarkMessageRead, useDeleteMessage, useProfessionals, useMe, type MessageDTO } from "@/hooks/api";
import { Avatar } from "@/components/domain";

type View = "inbox" | "sent" | "compose" | "read";

export function MessagingPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [view, setView] = useState<View>("inbox");
  const [selected, setSelected] = useState<MessageDTO | null>(null);
  const [box, setBox] = useState<"inbox" | "sent">("inbox");

  const { data: inbox } = useMessages("inbox");
  const { data: sent } = useMessages("sent");
  const { data: professionals } = useProfessionals();
  const { data: me } = useMe();
  const markRead = useMarkMessageRead();
  const deleteMsg = useDeleteMessage();
  const send = useSendMessage();

  const [toId, setToId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const messages = box === "inbox" ? (inbox ?? []) : (sent ?? []);
  const unread = (inbox ?? []).filter((m) => !m.readAt).length;

  function openMessage(m: MessageDTO) {
    setSelected(m);
    setView("read");
    if (!m.readAt && m.toId === me?.id) {
      markRead.mutate(m.id);
    }
  }

  function openCompose(replyTo?: MessageDTO) {
    setToId(replyTo ? replyTo.fromId : "");
    setSubject(replyTo ? `Re: ${replyTo.subject}` : "");
    setBody("");
    setError("");
    setView("compose");
  }

  async function handleSend() {
    if (!toId || !subject.trim() || !body.trim()) {
      setError("Completa todos los campos.");
      return;
    }
    setSending(true);
    setError("");
    try {
      await send.mutateAsync({ toId, subject: subject.trim(), body: body.trim() });
      setView("sent");
      setBox("sent");
    } catch {
      setError("Error al enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  function handleDelete(id: string) {
    deleteMsg.mutate(id);
    if (view === "read") setView(box);
    setSelected(null);
  }

  const others = (professionals ?? []).filter((p) => p.id !== me?.id && p.isActive);

  const fmtDate = (d: string) => {
    try {
      const date = new Date(d);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
      if (diffDays === 0) return format(date, "HH:mm");
      if (diffDays < 7) return format(date, "EEEE", { locale: es });
      return format(date, "dd MMM", { locale: es });
    } catch { return d; }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:w-[480px] p-0 flex flex-col">

        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b flex-row items-center gap-2">
          {(view === "read" || view === "compose") && (
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"
              onClick={() => { setView(box); setSelected(null); }}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          <SheetTitle className="text-base flex-1">
            {view === "compose" ? "Nuevo mensaje"
              : view === "read" ? selected?.subject ?? "Mensaje"
              : "Mensajes"}
          </SheetTitle>
          {view !== "compose" && view !== "read" && (
            <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => openCompose()}>
              <Pencil className="w-3.5 h-3.5" /> Redactar
            </Button>
          )}
          {view === "read" && selected && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => handleDelete(selected.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </SheetHeader>

        {/* Inbox/Sent tabs */}
        {view !== "compose" && view !== "read" && (
          <div className="flex border-b">
            <button
              className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${box === "inbox" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setBox("inbox")}
            >
              <Inbox className="w-3.5 h-3.5" />
              Recibidos
              {unread > 0 && (
                <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">{unread}</span>
              )}
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1.5 border-b-2 transition-colors ${box === "sent" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              onClick={() => setBox("sent")}
            >
              <Send className="w-3.5 h-3.5" />
              Enviados
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* List view */}
          {(view === "inbox" || view === "sent") && (
            <>
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
                  <Mail className="w-8 h-8 opacity-40" />
                  <p className="text-sm">{box === "inbox" ? "Sin mensajes recibidos" : "Sin mensajes enviados"}</p>
                </div>
              ) : (
                <ul>
                  {messages.map((m) => {
                    const other = box === "inbox" ? m.from : m.to;
                    const unreadMsg = !m.readAt && box === "inbox";
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          className={`w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors flex gap-3 items-start ${unreadMsg ? "bg-primary/5" : ""}`}
                          onClick={() => openMessage(m)}
                        >
                          <Avatar name={other.name} color={other.color} size={32} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className={`text-sm truncate ${unreadMsg ? "font-semibold" : "font-medium"}`}>{other.name}</span>
                              <span className="text-[11px] text-muted-foreground shrink-0">{fmtDate(m.createdAt)}</span>
                            </div>
                            <p className={`text-xs truncate ${unreadMsg ? "text-foreground font-medium" : "text-muted-foreground"}`}>{m.subject}</p>
                            <p className="text-xs text-muted-foreground truncate">{m.body}</p>
                          </div>
                          {unreadMsg && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {/* Read view */}
          {view === "read" && selected && (
            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={selected.from.name} color={selected.from.color} size={36} />
                <div>
                  <p className="text-sm font-medium">{selected.from.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Para: {selected.to.name} · {format(new Date(selected.createdAt), "dd MMM yyyy HH:mm", { locale: es })}
                  </p>
                </div>
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap border-t pt-4">{selected.body}</div>
              {selected.toId === me?.id && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => openCompose(selected)}>
                  <Send className="w-3.5 h-3.5" /> Responder
                </Button>
              )}
            </div>
          )}

          {/* Compose view */}
          {view === "compose" && (
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Para</label>
                <Select value={toId} onValueChange={setToId}>
                  <SelectTrigger><SelectValue placeholder="Selecciona profesional…" /></SelectTrigger>
                  <SelectContent>
                    {others.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Asunto</label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Asunto…" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Mensaje</label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escribe tu mensaje…" rows={10} className="resize-none" />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button className="w-full gap-1.5" onClick={handleSend} disabled={sending}>
                <Send className="w-4 h-4" />
                {sending ? "Enviando…" : "Enviar"}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Bell icon with badge — for the header ────────────────────────────────────
export function MessagingTrigger() {
  const [open, setOpen] = useState(false);
  const { data: inbox } = useMessages("inbox");
  const unread = (inbox ?? []).filter((m) => !m.readAt).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        aria-label={unread > 0 ? `${unread} mensajes sin leer` : "Mensajes"}
      >
        <Mail className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      <MessagingPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
