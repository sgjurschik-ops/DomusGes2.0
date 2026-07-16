"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAppointments, usePatients, useProfessionals, useCurrentSession } from "@/hooks/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/domain";
import { useNav } from "@/store/nav";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MapPin, Navigation, Clock, Car, Bike, Footprints, ExternalLink, RotateCcw, Plus, X, GripVertical, CalendarDays, Route } from "lucide-react";
import { AddressSearch } from "@/components/address-search";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ─── Geocoding cache (localStorage) ─────────────────────────────────────────
const GEO_CACHE_KEY = "domusges_geocache";
function getGeoCache(): Record<string, [number, number]> {
  try { return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || "{}"); } catch { return {}; }
}
function setGeoCache(cache: Record<string, [number, number]>) {
  try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache)); } catch { /* ignore */ }
}
async function geocodeAddress(address: string): Promise<[number, number] | null> {
  const cache = getGeoCache();
  const key = address.trim().toLowerCase();
  if (cache[key]) return cache[key];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=es`,
      { headers: { "User-Agent": "DomusGes-ClinicalApp/1.0" } }
    );
    const data = await res.json();
    if (data.length > 0) {
      const coords: [number, number] = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      cache[key] = coords;
      setGeoCache(cache);
      return coords;
    }
  } catch { /* silent */ }
  return null;
}

// ─── OSRM routing ───────────────────────────────────────────────────────────
type TransportMode = "driving" | "cycling" | "walking";
const OSRM_PROFILES: Record<TransportMode, string> = { driving: "car", cycling: "bike", walking: "foot" };
interface RouteResult { coordinates: [number, number][]; totalMinutes: number; totalKm: number; legs: { minutes: number; km: number }[]; }

async function fetchRoute(waypoints: [number, number][], mode: TransportMode): Promise<RouteResult | null> {
  if (waypoints.length < 2) return null;
  const coords = waypoints.map((w) => `${w[1]},${w[0]}`).join(";");
  try {
    const res = await fetch(`https://router.project-osrm.org/route/v1/${OSRM_PROFILES[mode]}/${coords}?overview=full&geometries=geojson&steps=false`);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;
    const route = data.routes[0];
    return {
      coordinates: route.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]),
      totalMinutes: Math.round(route.duration / 60),
      totalKm: Math.round((route.distance / 1000) * 10) / 10,
      legs: route.legs.map((l: any) => ({ minutes: Math.round(l.duration / 60), km: Math.round((l.distance / 1000) * 10) / 10 })),
    };
  } catch { return null; }
}

// ─── Google Maps URL ────────────────────────────────────────────────────────
function buildGoogleMapsUrl(waypoints: { address: string }[], mode: TransportMode): string {
  const gmMode = mode === "driving" ? "driving" : mode === "cycling" ? "bicycling" : "walking";
  if (waypoints.length === 0) return "https://www.google.com/maps";
  if (waypoints.length === 1) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(waypoints[0].address)}&travelmode=${gmMode}`;
  const origin = encodeURIComponent(waypoints[0].address);
  const destination = encodeURIComponent(waypoints[waypoints.length - 1].address);
  const middle = waypoints.slice(1, -1).map((w) => encodeURIComponent(w.address)).join("|");
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${gmMode}`;
  if (middle) url += `&waypoints=${middle}`;
  return url;
}

const STOP_COLORS = ["#4A6D8C", "#5B7A5E", "#A0713F", "#7A5B94", "#8C7A3D", "#5A7A6D", "#8C5A5A", "#6D5A8C"];
type UserRole = "admin" | "therapist" | "guest";
const DEFAULT_START = "Pamplona, Navarra";

// ─── Route stop (unified: from appointment or manually added) ───────────────
interface RouteStop {
  id: string;
  patientId: string;
  name: string;
  address: string;
  time?: string; // only for appointment-based stops
  type?: string;
  source: "appointment" | "manual";
}

export function TodayView() {
  const { data: appts, isLoading } = useAppointments({ from: startOfDayISO(), to: endOfDayISO() });
  const { data: patients } = usePatients();
  const { data: professionals } = useProfessionals();
  const { user } = useCurrentSession();
  const { selectPatient, navigate } = useNav();

  const [filterProfId, setFilterProfId] = useState<string>("all");
  const [startAddress, setStartAddress] = useState(DEFAULT_START);
  const [mode, setMode] = useState<TransportMode>("driving");
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [geocodedStops, setGeocodedStops] = useState<{ id: string; name: string; address: string; coords: [number, number] }[]>([]);
  const [startCoords, setStartCoords] = useState<[number, number] | null>(null);
  const [manualStops, setManualStops] = useState<RouteStop[]>([]);
  const [tab, setTab] = useState<"today" | "custom">("today");
  const [patientSearch, setPatientSearch] = useState("");

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  const userRole: UserRole = (user as { userRole?: UserRole } | undefined)?.userRole ?? "therapist";
  const isAdmin = userRole === "admin";

  // Appointment-based stops
  const filtered = isAdmin
    ? (appts ?? []).filter((a) => filterProfId === "all" || a.therapistId === filterProfId)
    : (appts ?? []);
  const apptStops: RouteStop[] = [...filtered]
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .filter((a) => a.patientAddress)
    .map((a) => ({
      id: a.id,
      patientId: a.patientId,
      name: a.patientName,
      address: a.patientAddress!,
      time: new Date(a.start).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }),
      type: a.type,
      source: "appointment" as const,
    }));

  // Active stops: either today's appointments or manual list
  const activeStops = tab === "today" ? apptStops : manualStops;

  // Patients available to add (have address, not already in manual list)
  const addablePatients = (patients ?? [])
    .filter((p) => p.address && !manualStops.some((s) => s.patientId === p.id))
    .filter((p) => !patientSearch || p.fullName.toLowerCase().includes(patientSearch.toLowerCase()));
  const [showPatientList, setShowPatientList] = useState(false);

  function addPatientToRoute(p: { id: string; fullName: string; address: string | null }) {
    if (!p.address) return;
    setManualStops((prev) => [...prev, { id: `manual-${p.id}`, patientId: p.id, name: p.fullName, address: p.address!, source: "manual" }]);
    setPatientSearch("");
  }
  function removeManualStop(id: string) { setManualStops((prev) => prev.filter((s) => s.id !== id)); }
  function moveStop(idx: number, dir: -1 | 1) {
    setManualStops((prev) => {
      const arr = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= arr.length) return prev;
      [arr[idx], arr[target]] = [arr[target], arr[idx]];
      return arr;
    });
  }

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, { center: [42.8125, -1.6456], zoom: 13, scrollWheelZoom: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap" }).addTo(map);
    mapInstance.current = map;
    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  // Geocode only NEW stops incrementally (don't re-geocode what's already resolved)
  const geocodedRef = useRef<Map<string, { name: string; address: string; coords: [number, number] }>>(new Map());
  const [failedAddresses, setFailedAddresses] = useState<string[]>([]);

  const stopsKey = activeStops.map((s) => s.id).join(",");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      // Geocode start address if changed
      const sCoords = await geocodeAddress(startAddress);
      if (cancelled) return;
      setStartCoords(sCoords);

      // Find which stops need geocoding
      const currentIds = new Set(activeStops.map((s) => s.id));
      // Remove stale entries
      for (const key of geocodedRef.current.keys()) {
        if (!currentIds.has(key)) geocodedRef.current.delete(key);
      }

      const toGeocode = activeStops.filter((s) => !geocodedRef.current.has(s.id));
      if (toGeocode.length > 0) {
        setIsCalculating(true);
        const failed: string[] = [];
        for (const s of toGeocode) {
          if (cancelled) return;
          const coords = await geocodeAddress(s.address);
          if (coords) {
            geocodedRef.current.set(s.id, { name: s.name, address: s.address, coords });
          } else {
            failed.push(s.name);
          }
          // Rate limit only if there are more to process
          if (toGeocode.indexOf(s) < toGeocode.length - 1) {
            await new Promise((r) => setTimeout(r, 1100));
          }
        }
        if (cancelled) return;
        setFailedAddresses(failed);
        setIsCalculating(false);
      }

      // Build ordered geocoded stops from current active stops
      const ordered = activeStops
        .filter((s) => geocodedRef.current.has(s.id))
        .map((s) => ({ id: s.id, ...geocodedRef.current.get(s.id)! }));
      if (!cancelled) setGeocodedStops(ordered);
    }

    run();
    return () => { cancelled = true; };
  }, [stopsKey, startAddress]);

  // Calculate route
  useEffect(() => {
    if (geocodedStops.length === 0) { setRouteResult(null); return; }
    const wp: [number, number][] = [];
    if (startCoords) wp.push(startCoords);
    geocodedStops.forEach((s) => wp.push(s.coords));
    if (wp.length < 2) { setRouteResult(null); return; }
    fetchRoute(wp, mode).then((r) => setRouteResult(r));
  }, [geocodedStops, startCoords, mode]);

  // Draw markers and route
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (routeLayerRef.current) { routeLayerRef.current.remove(); routeLayerRef.current = null; }
    const allCoords: [number, number][] = [];
    if (startCoords) {
      const icon = L.divIcon({
        className: "", iconSize: [30, 30], iconAnchor: [15, 15],
        html: `<div style="background:#1a5c58;color:white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">●</div>`,
      });
      markersRef.current.push(L.marker(startCoords, { icon }).addTo(map).bindPopup(`<strong>Punto de partida</strong><br/>${startAddress}`));
      allCoords.push(startCoords);
    }
    geocodedStops.forEach((stop, idx) => {
      const color = STOP_COLORS[idx % STOP_COLORS.length];
      const icon = L.divIcon({
        className: "", iconSize: [30, 30], iconAnchor: [15, 30],
        html: `<div style="background:${color};color:white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"><span style="transform:rotate(45deg)">${idx + 1}</span></div>`,
      });
      const legInfo = routeResult?.legs?.[startCoords ? idx : idx - 1];
      const popupEl = document.createElement("div");
      popupEl.innerHTML = `<p style="font-weight:600;font-size:13px;margin:0 0 2px;">${stop.name}</p><p style="font-size:11px;color:#6b7280;margin:0 0 4px;">${stop.address}</p>${legInfo ? `<p style="font-size:11px;color:#4A6D8C;margin:0;">${legInfo.km} km · ${legInfo.minutes} min</p>` : ""}`;
      const btn = document.createElement("button");
      btn.textContent = "Ver paciente";
      btn.style.cssText = "margin-top:6px;padding:3px 10px;font-size:11px;background:#1a5c58;color:white;border:none;border-radius:6px;cursor:pointer;";
      const activeStop = activeStops.find((s) => s.id === stop.id);
      if (activeStop) btn.onclick = () => { selectPatient(activeStop.patientId); navigate("patient-detail"); };
      popupEl.appendChild(btn);
      markersRef.current.push(L.marker(stop.coords, { icon }).addTo(map).bindPopup(popupEl));
      allCoords.push(stop.coords);
    });
    if (routeResult?.coordinates) {
      const colors: Record<TransportMode, string> = { driving: "#4A6D8C", cycling: "#5B7A5E", walking: "#A0713F" };
      routeLayerRef.current = L.polyline(routeResult.coordinates, {
        color: colors[mode], weight: 4, opacity: 0.7, dashArray: mode === "walking" ? "8, 12" : undefined,
      }).addTo(map);
    }
    if (allCoords.length > 0) map.fitBounds(allCoords, { padding: [40, 40], maxZoom: 15 });
  }, [geocodedStops, startCoords, routeResult, mode, activeStops, selectPatient, navigate, startAddress]);

  const googleMapsUrl = buildGoogleMapsUrl(
    [...(startCoords ? [{ address: startAddress }] : []), ...geocodedStops.map((s) => ({ address: s.address }))],
    mode
  );

  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] max-w-sm">
          <AddressSearch
            value={startAddress}
            onChange={(addr) => setStartAddress(addr)}
            onCoordsChange={(coords) => { if (coords) setStartCoords(coords); }}
            placeholder="Punto de partida…"
            showLocateButton
          />
        </div>

        <div className="flex items-center gap-1 rounded-md border p-0.5">
          {([
            { value: "driving" as TransportMode, icon: Car, label: "Coche" },
            { value: "cycling" as TransportMode, icon: Bike, label: "Bici" },
            { value: "walking" as TransportMode, icon: Footprints, label: "Andando" },
          ]).map(({ value, icon: Icon, label }) => (
            <button key={value} type="button" onClick={() => setMode(value)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${mode === value ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`} title={label}>
              <Icon className="w-3.5 h-3.5" /><span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {isAdmin && (
          <Select value={filterProfId} onValueChange={setFilterProfId}>
            <SelectTrigger className="h-8 w-48"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(professionals ?? []).map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
            </SelectContent>
          </Select>
        )}

        {routeResult && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground ml-auto">
            <span className="font-medium text-foreground">{routeResult.totalKm} km</span>
            <span>·</span>
            <span className="font-medium text-foreground">{routeResult.totalMinutes} min</span>
          </div>
        )}

        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => window.open(googleMapsUrl, "_blank")} disabled={geocodedStops.length === 0}>
          <ExternalLink className="w-3.5 h-3.5 mr-1" />Google Maps
        </Button>
      </div>

      {/* Map + stops panel */}
      <div className="grid lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2 overflow-hidden relative">
          <div ref={mapRef} className="h-[480px] w-full" role="application" aria-label="Mapa de ruta" />
          {isCalculating && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RotateCcw className="w-4 h-4 animate-spin" /> Geocodificando direcciones…
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-2">
          {/* Tab switcher */}
          <div className="flex rounded-md border p-0.5 text-xs">
            <button type="button" onClick={() => setTab("today")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded transition-colors ${tab === "today" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}>
              <CalendarDays className="w-3.5 h-3.5" /> Citas de hoy
            </button>
            <button type="button" onClick={() => setTab("custom")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded transition-colors ${tab === "custom" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}>
              <Route className="w-3.5 h-3.5" /> Ruta manual
            </button>
          </div>

          {/* Manual route: patient search + add */}
          {tab === "custom" && (
            <div className="space-y-1.5">
              <div className="relative">
                <Input value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)}
                  onFocus={() => setShowPatientList(true)}
                  onBlur={() => setTimeout(() => setShowPatientList(false), 200)}
                  placeholder="Buscar paciente para añadir…" className="h-8 text-sm pr-8" />
                <Plus className="w-4 h-4 absolute right-2 top-2 text-muted-foreground pointer-events-none" />
              </div>
              {showPatientList && addablePatients.length > 0 && (
                <div className="border rounded-md max-h-40 overflow-y-auto bg-card shadow-sm">
                  {addablePatients.slice(0, 10).map((p) => (
                    <button key={p.id} type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => { addPatientToRoute(p); setShowPatientList(false); }}
                      className="w-full text-left px-3 py-1.5 hover:bg-muted text-sm flex items-center justify-between gap-2 border-b last:border-0">
                      <span className="truncate">{p.fullName}</span>
                      <span className="text-[10px] text-muted-foreground truncate max-w-[140px]">{p.address}</span>
                    </button>
                  ))}
                </div>
              )}
              {showPatientList && addablePatients.length === 0 && (
                <p className="text-xs text-muted-foreground italic px-1">No se encontraron pacientes con dirección.</p>
              )}
            </div>
          )}

          {/* Stops list */}
          {isLoading && tab === "today" ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => (<Skeleton key={i} className="h-16 w-full" />))}</div>
          ) : activeStops.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              <MapPin className="w-7 h-7 mx-auto mb-2 opacity-50" />
              {tab === "today" ? "No hay citas programadas para hoy." : "Añade pacientes para crear tu ruta."}
            </Card>
          ) : (
            <ol className="space-y-1.5">
              {/* Starting point as first stop */}
              <li>
                <Card className="p-2.5 border-primary/30 bg-primary/5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[11px] shrink-0 bg-[#1a5c58]">●</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Inicio</p>
                      <p className="text-sm font-medium truncate">{startAddress}</p>
                    </div>
                  </div>
                </Card>
              </li>
              {activeStops.map((s, idx) => {
                const legInfo = routeResult?.legs?.[startCoords ? idx : idx - 1];
                const color = STOP_COLORS[idx % STOP_COLORS.length];
                return (
                  <li key={s.id}>
                    <Card className="p-2.5 hover:shadow-md transition-shadow cursor-pointer group" role="button" tabIndex={0}
                      onClick={() => { selectPatient(s.patientId); navigate("patient-detail"); }}>
                      <div className="flex items-center gap-2">
                        {tab === "custom" && (
                          <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <button type="button" onClick={() => moveStop(idx, -1)} className="text-muted-foreground hover:text-foreground text-[10px]">▲</button>
                            <button type="button" onClick={() => moveStop(idx, 1)} className="text-muted-foreground hover:text-foreground text-[10px]">▼</button>
                          </div>
                        )}
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[11px] shrink-0" style={{ backgroundColor: color }}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{s.name}</p>
                          {s.time && (
                            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                              <Clock className="w-3 h-3" />{s.time}{s.type ? ` · ${s.type}` : ""}
                            </p>
                          )}
                          <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3" />{s.address}
                          </p>
                        </div>
                        {legInfo && (
                          <div className="text-right shrink-0">
                            <p className="text-[11px] font-medium" style={{ color }}>{legInfo.km} km</p>
                            <p className="text-[10px] text-muted-foreground">{legInfo.minutes} min</p>
                          </div>
                        )}
                        {tab === "custom" && (
                          <button type="button" onClick={(e) => { e.stopPropagation(); removeManualStop(s.id); }}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ol>
          )}
          {failedAddresses.length > 0 && (
            <div className="text-xs text-orange-700 bg-orange-50 rounded-md px-3 py-2">
              <p className="font-medium">Dirección no encontrada:</p>
              {failedAddresses.map((name) => <p key={name} className="text-orange-600">· {name}</p>)}
              <p className="mt-1 text-orange-500 italic">Revisa la dirección en la ficha del paciente.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function startOfDayISO() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString(); }
function endOfDayISO() { const d = new Date(); d.setHours(23, 59, 59, 999); return d.toISOString(); }
