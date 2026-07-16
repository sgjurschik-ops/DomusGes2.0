"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface RichTextareaProps {
  value: string;
  onChange: (html: string) => void;
  rows?: number;
  placeholder?: string;
}

export function RichTextarea({ value, onChange, rows = 3, placeholder }: RichTextareaProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (ref.current && !focused) {
      if (ref.current.innerHTML !== value) {
        ref.current.innerHTML = value || "";
      }
    }
  }, [value, focused]);

  function handleFormat(cmd: "bold" | "italic" | "underline") {
    document.execCommand(cmd, false);
    ref.current?.focus();
    if (ref.current) onChange(ref.current.innerHTML);
  }

  function toggleDictation() {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({ title: "Dictado no disponible", description: "Tu navegador no soporta reconocimiento de voz.", variant: "destructive" });
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognitionRef.current = recognition;
    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      if (event.results[event.results.length - 1].isFinal && ref.current) {
        const current = ref.current.innerHTML;
        const separator = current && !current.endsWith(" ") && !current.endsWith("<br>") ? " " : "";
        ref.current.innerHTML = current + separator + transcript;
        onChange(ref.current.innerHTML);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    setIsListening(true);
  }

  useEffect(() => { return () => { recognitionRef.current?.stop(); }; }, []);

  return (
    <div className={`rounded-md border ${focused ? "ring-2 ring-ring" : ""} ${!value ? "border-dashed border-muted-foreground/40" : ""}`}>
      <div className="flex items-center gap-0.5 px-2 py-1 border-b bg-muted/30">
        <button type="button" className="px-1.5 py-0.5 rounded text-xs font-bold hover:bg-muted" onClick={() => handleFormat("bold")} title="Negrita"><b>N</b></button>
        <button type="button" className="px-1.5 py-0.5 rounded text-xs italic hover:bg-muted" onClick={() => handleFormat("italic")} title="Cursiva"><i>K</i></button>
        <button type="button" className="px-1.5 py-0.5 rounded text-xs underline hover:bg-muted" onClick={() => handleFormat("underline")} title="Subrayado"><u>S</u></button>
        <div className="flex-1" />
        <button type="button" className={`px-1.5 py-0.5 rounded text-xs hover:bg-muted flex items-center gap-1 ${isListening ? "text-red-500 bg-red-50" : "text-muted-foreground"}`} onClick={toggleDictation} title={isListening ? "Detener dictado" : "Dictar por voz"}>
          {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          <span>{isListening ? "Dictando…" : "Dictar"}</span>
        </button>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning
        className="px-3 py-2 text-sm outline-none min-h-[2.5rem] [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground"
        style={{ minHeight: `${rows * 1.5}rem` }}
        data-placeholder={placeholder ?? ""}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); if (ref.current) onChange(ref.current.innerHTML); }}
        onInput={() => { if (ref.current) onChange(ref.current.innerHTML); }}
      />
    </div>
  );
}
