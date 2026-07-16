"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Locate } from "lucide-react";

interface AddressSearchProps {
  value: string;
  onChange: (value: string) => void;
  onCoordsChange?: (coords: [number, number] | null) => void;
  placeholder?: string;
  className?: string;
  showLocateButton?: boolean;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

export function AddressSearch({
  value,
  onChange,
  onCoordsChange,
  placeholder = "Buscar dirección…",
  className,
  showLocateButton = false,
}: AddressSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sync external value changes
  useEffect(() => { setQuery(value); }, [value]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleInputChange(text: string) {
    setQuery(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (text.trim().length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&limit=5&countrycodes=es&addressdetails=1`,
          { headers: { "User-Agent": "DomusGes-ClinicalApp/1.0" } }
        );
        const data: NominatimResult[] = await res.json();
        setResults(data);
        setIsOpen(data.length > 0);
      } catch {
        setResults([]);
      }
      setIsSearching(false);
    }, 400);
  }

  function selectResult(result: NominatimResult) {
    const addr = result.display_name;
    setQuery(addr);
    onChange(addr);
    onCoordsChange?.([parseFloat(result.lat), parseFloat(result.lon)]);
    setIsOpen(false);
    setResults([]);
  }

  function handleBlur() {
    // Small delay to allow click on results
    setTimeout(() => {
      if (query !== value) onChange(query);
      setIsOpen(false);
    }, 200);
  }

  function locateMe() {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { "User-Agent": "DomusGes-ClinicalApp/1.0" } }
          );
          const data = await res.json();
          if (data.display_name) {
            setQuery(data.display_name);
            onChange(data.display_name);
            onCoordsChange?.([latitude, longitude]);
          }
        } catch { /* silent */ }
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ""}`}>
      <div className="flex items-center gap-1.5">
        <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
        <Input
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="h-8 text-sm"
        />
        {showLocateButton && (
          <button
            type="button"
            onClick={locateMe}
            disabled={isLocating}
            className="shrink-0 p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Usar mi ubicación actual"
          >
            <Locate className={`w-4 h-4 ${isLocating ? "animate-pulse" : ""}`} />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectResult(r)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-0 flex items-start gap-2"
            >
              <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <span className="text-xs leading-relaxed">{r.display_name}</span>
            </button>
          ))}
        </div>
      )}

      {isSearching && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg px-3 py-2 text-xs text-muted-foreground">
          Buscando…
        </div>
      )}
    </div>
  );
}
