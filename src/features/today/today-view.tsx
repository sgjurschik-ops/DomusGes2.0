"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useAppointments, usePatients, useProfessionals, useCurrentSession } from "@/hooks/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, SpecialtyBadge } from "@/components/domain";
import { useNav } from "@/store/nav";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MapPin, Navigation, Clock, Car, Bike, Footprints, ExternalLink, RotateCcw } from "lucide-react";
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

const OSRM_PROFILES: Record<TransportMode, string> = {
  driving: "car",
  cycling: "bike",
  walking: "foot",
};

interface RouteResult {
  coordinates: [number, number][];
  totalMinutes: number;
  totalKm: number;
  legs: { minutes: number; km: number }[];
}

async function fetchRoute(waypoints: [number, number][], mode: TransportMode): Promise<RouteResult | null> {
  if (waypoints.length < 2) return null;
  const profile = OSRM_PROFILES[mode];
  const coords = waypoints.map((w) => `${w[1]},${w[0]}`).join(";");
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=false`
    );
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return null;
    const route = data.routes[0];
    return {
      coordinates: route.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]),
      totalMinutes: Math.round(route.duration / 60),
      totalKm: Math.round((route.distance / 1000) * 10) / 10,
      legs: route.legs.map((l: any) => ({
        minutes: Math.round(l.duration / 60),
        km: Math.round((l.distance / 1000) * 10) / 10,
      })),
    };
  } catch { return null; }
}

// ─── Google Maps URL builder ────────────────────────────────────────────────
function buildGoogleMapsUrl(waypoints: { address: string; coords: [number, number] }[], mode: TransportMode): string {
  const gmMode = mode === "driving" ? "driving" : mode === "cycling" ? "bicycling" : "walking";
  if (waypoints.length === 0) return "https://www.google.com/maps";
  if (waypoints.length === 1) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(waypoints[0].address)}&travelmode=${gmMode}`;
  }
  const origin = encodeURIComponent(waypoints[0].address);
  const destination = encodeURIComponent(waypoints[waypoints.length - 1].address);
  const middleStops = waypoints.slice(1, -1).map((w) => encodeURIComponent(w.address)).join("|");
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${gmMode}`;
  if (middleStops) url += `&waypoints=${middleStops}`;
  return url;
}

// ─── Marker colors ──────────────────────────────────────────────────────────
const STOP_COLORS = ["#4A6D8C", "#5B7A5E", "#A0713F", "#7A5B94", "#8C7A3D", "#5A7A6D", "#8C5A5A", "#6D5A8C"];

type UserRole = "admin" | "therapist" | "guest";

// Default starting point
const DEFAULT_START = "Pamplona, Navarra";

export function TodayView() {
  const { data: appts, isLoading } = useAppointments({
    from: startOfDayISO(),
    to: endOfDayISO(),
  });
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

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const routeLayerRef = useRef<L.Polyline | null>(null);

  const userRole: UserRole = (user as { userRole?: UserRole } | undefined)?.userRole ?? "therapist";
  const isAdmin = userRole === "admin";

  const filtered = isAdmin
    ? (appts ?? []).filter((a) => filterProfId === "all" || a.therapistId === filterProfId)
    : (appts ?? []);

  const sortedAppts = [...filtered].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Init map once
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, {
      center: [42.8125, -1.6456],
      zoom: 13,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    mapInstance.current = map;
    return () => { map.remove(); mapInstance.current = null; };
  }, []);

  // Geocode all stops when appointments change
  const geocodeAll = useCallback(async () => {
    if (sortedAppts.length === 0) { setGeocodedStops([]); return; }
    setIsCalculating(true);

    // Geocode start
    const sCoords = await geocodeAddress(startAddress);
    setStartCoords(sCoords);

    // Geocode each appointment's patient address
    const stops: typeof geocodedStops = [];
    for (const a of sortedAppts) {
      const addr = a.patientAddress;
      if (!addr) continue;
      const coords = await geocodeAddress(addr);
      if (coords) {
        stops.push({ id: a.id, name: a.patientName, address: addr, coords });
      }
      // Nominatim rate limit: 1 req/sec
      await new Promise((r) => setTimeout(r, 1100));
    }
    setGeocodedStops(stops);
    setIsCalculating(false);
  }, [sortedAppts.map((a) => a.id).join(","), startAddress]);

  useEffect(() => { geocodeAll(); }, [geocodeAll]);

  // Calculate route when stops or mode change
  useEffect(() => {
    if (geocodedStops.length === 0) { setRouteResult(null); return; }
    const waypoints: [number, number][] = [];
    if (startCoords) waypoints.push(startCoords);
    geocodedStops.forEach((s) => waypoints.push(s.coords));

    if (waypoints.length < 2) { setRouteResult(null); return; }

    fetchRoute(waypoints, mode).then((r) => setRouteResult(r));
  }, [geocodedStops, startCoords, mode]);

  // Draw markers and route on map
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Clear existing
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (routeLayerRef.current) { routeLayerRef.current.remove(); routeLayerRef.current = null; }

    const allCoords: [number, number][] = [];

    // Start marker
    if (startCoords) {
      const startIcon = L.divIcon({
        className: "",
        html: `<div style="background:#1a5c58;color:white;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);">●</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const m = L.marker(startCoords, { icon: startIcon }).addTo(map);
      m.bindPopup(`<strong>Punto de partida</strong><br/>${startAddress}`);
      markersRef.current.push(m);
      allCoords.push(startCoords);
    }

    // Stop markers
    geocodedStops.forEach((stop, idx) => {
      const color = STOP_COLORS[idx % STOP_COLORS.length];
      const icon = L.divIcon({
        className: "",
        html: `<div style="background:${color};color:white;border-radius:50% 50% 50% 0;transform:rotate(-45deg);width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);"><span style="transform:rotate(45deg)">${idx + 1}</span></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      });
      const m = L.marker(stop.coords, { icon }).addTo(map);

      const legInfo = routeResult?.legs?.[startCoords ? idx : idx - 1];
      const popupEl = document.createElement("div");
      popupEl.style.cssText = "font-family:inherit;min-width:180px;";
      popupEl.innerHTML = `
        <p style="font-weight:600;font-size:13px;margin:0 0 2px;">${stop.name}</p>
        <p style="font-size:11px;color:#6b7280;margin:0 0 4px;">${stop.address}</p>
        ${legInfo ? `<p style="font-size:11px;color:#4A6D8C;margin:0;">${legInfo.km} km · ${legInfo.minutes} min</p>` : ""}
      `;
      const btn = document.createElement("button");
      btn.textContent = "Ver paciente";
      btn.style.cssText = "margin-top:6px;padding:3px 10px;font-size:11px;background:#1a5c58;color:white;border:none;border-radius:6px;cursor:pointer;";
      const appt = sortedAppts.find((a) => a.id === stop.id);
      if (appt) {
        btn.onclick = () => { selectPatient(appt.patientId); navigate("patient-detail"); };
      }
      popupEl.appendChild(btn);
      m.bindPopup(popupEl);
      markersRef.current.push(m);
      allCoords.push(stop.coords);
    });

    // Draw route polyline
    if (routeResult?.coordinates) {
      const modeColors: Record<TransportMode, string> = { driving: "#4A6D8C", cycling: "#5B7A5E", walking: "#A0713F" };
      routeLayerRef.current = L.polyline(routeResult.coordinates, {
        color: modeColors[mode],
        weight: 4,
        opacity: 0.7,
        dashArray: mode === "walking" ? "8, 12" : undefined,
      }).addTo(map);
    }

    // Fit bounds
    if (allCoords.length > 0) {
      map.fitBounds(allCoords, { padding: [40, 40], maxZoom: 15 });
    }
  }, [geocodedStops, startCoords, routeResult, mode, sortedAppts, selectPatient, navigate, startAddress]);

  // Build Google Maps URL for all stops
  const googleMapsUrl = buildGoogleMapsUrl(
    [
      ...(startCoords ? [{ address: startAddress, coords: startCoords }] : []),
      ...geocodedStops.map((s) => ({ address: s.address, coords: s.coords })),
    ],
    mode
  );

  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-1 min-w-[200px] max-w-sm">
          <Navigation className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            value={startAddress}
            onChange={(e) => setStartAddress(e.target.value)}
            placeholder="Punto de partida..."
            className="h-8 text-sm"
            onBlur={geocodeAll}
            onKeyDown={(e) => { if (e.key === "Enter") geocodeAll(); }}
          />
        </div>

        <div className="flex items-center gap-1 rounded-md border p-0.5">
          {([
            { value: "driving" as TransportMode, icon: Car, label: "Coche" },
            { value: "cycling" as TransportMode, icon: Bike, label: "Bici" },
            { value: "walking" as TransportMode, icon: Footprints, label: "Andando" },
          ]).map(({ value, icon: Icon, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${mode === value ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
              title={label}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {isAdmin && (
          <Select value={filterProfId} onValueChange={setFilterProfId}>
            <SelectTrigger className="h-8 w-48" aria-label="Filtrar por terapeuta">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los terapeutas</SelectItem>
              {(professionals ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
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
          <ExternalLink className="w-3.5 h-3.5 mr-1" />
          Abrir en Google Maps
        </Button>
      </div>

      {/* Map + stops list */}
      <div className="grid lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2 overflow-hidden relative">
          <div ref={mapRef} className="h-[480px] w-full" role="application" aria-label="Mapa de ruta de hoy" />
          {isCalculating && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RotateCcw className="w-4 h-4 animate-spin" /> Geocodificando direcciones…
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-2">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : sortedAppts.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
              No hay citas programadas para hoy.
            </Card>
          ) : (
            <ol className="space-y-1.5">
              {sortedAppts.map((a, idx) => {
                const stop = geocodedStops.find((s) => s.id === a.id);
                const legInfo = routeResult?.legs?.[startCoords ? idx : idx - 1];
                const color = STOP_COLORS[idx % STOP_COLORS.length];
                return (
                  <li key={a.id}>
                    <Card
                      className="p-2.5 hover:shadow-md transition-shadow cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => { selectPatient(a.patientId); navigate("patient-detail"); }}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white font-bold text-[11px] shrink-0"
                          style={{ backgroundColor: color }}
                        >
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{a.patientName}</p>
                          <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(a.start).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                            {" · "}{a.type}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {a.patientAddress ?? "Sin dirección"}
                          </p>
                        </div>
                        {legInfo && (
                          <div className="text-right shrink-0">
                            <p className="text-[11px] font-medium" style={{ color }}>{legInfo.km} km</p>
                            <p className="text-[10px] text-muted-foreground">{legInfo.minutes} min</p>
                          </div>
                        )}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function startOfDayISO() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
}
function endOfDayISO() {
  const d = new Date(); d.setHours(23, 59, 59, 999); return d.toISOString();
}
