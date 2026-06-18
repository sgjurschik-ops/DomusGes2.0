"use client";

import { useEffect, useRef, useState } from "react";
import { useAppointments, usePatients, useProfessionals, useCurrentSession } from "@/hooks/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, SpecialtyBadge } from "@/components/domain";
import { useNav } from "@/store/nav";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MapPin, Navigation2, Clock } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Pamplona center
const PAMPLONA: [number, number] = [42.8125, -1.6456];
// Demo coordinates near Pamplona for fake patient addresses
const PATIENT_COORDS: Record<string, [number, number]> = {};
const SAMPLE_COORDS: [number, number][] = [
  [42.8201, -1.6434], [42.8157, -1.6512], [42.8253, -1.6401],
  [42.8180, -1.6612], [42.8085, -1.6489], [42.8217, -1.6558],
];

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
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const filtered = (appts ?? []).filter((a) => filterProfId === "all" || a.therapistId === filterProfId);

  // Assign demo coords to patients on first load
  useEffect(() => {
    if (patients) {
      patients.forEach((p, i) => {
        if (!PATIENT_COORDS[p.id]) {
          PATIENT_COORDS[p.id] = SAMPLE_COORDS[i % SAMPLE_COORDS.length];
        }
      });
    }
  }, [patients]);

  // Init map once
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    const map = L.map(mapRef.current, {
      center: PAMPLONA,
      zoom: 13,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    mapInstance.current = map;
    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update markers when filtered changes
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (filtered.length === 0) return;

    const bounds: [number, number][] = [];
    filtered.forEach((a, idx) => {
      const coords = PATIENT_COORDS[a.patientId] ?? SAMPLE_COORDS[idx % SAMPLE_COORDS.length];
      bounds.push(coords);
      // Use DOM APIs (not template literal HTML) to avoid XSS risk.
      const icon = L.divIcon({
        className: "domus-marker",
        html: (() => {
          const wrap = document.createElement("div");
          wrap.style.cssText = `
            background: ${a.patientColor};
            color: white;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            width: 28px; height: 28px;
            display: flex; align-items: center; justify-content: center;
            font-weight: 700; font-size: 12px;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          `;
          const span = document.createElement("span");
          span.style.transform = "rotate(45deg)";
          span.textContent = String(idx + 1);
          wrap.appendChild(span);
          return wrap.outerHTML;
        })(),
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });

      const marker = L.marker(coords, { icon }).addTo(map);

      // Build popup with safe DOM APIs
      const popup = L.popup();
      const popupEl = document.createElement("div");
      popupEl.style.cssText = "font-family: inherit; padding: 4px; min-width: 200px;";
      const time = document.createElement("p");
      time.style.cssText = "font-size: 11px; color: #6b7280; margin-bottom: 4px;";
      time.textContent = `${new Date(a.start).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })} · ${a.type}`;
      const name = document.createElement("p");
      name.style.cssText = "font-weight: 600; font-size: 14px; margin-bottom: 2px;";
      name.textContent = a.patientName;
      const addr = document.createElement("p");
      addr.style.cssText = "font-size: 12px; color: #6b7280;";
      addr.textContent = a.patientAddress ?? "Sin dirección";
      const btn = document.createElement("button");
      btn.textContent = "Ver paciente";
      btn.style.cssText = `
        margin-top: 8px; padding: 4px 10px; font-size: 12px;
        background: #1a5c58; color: white; border: none; border-radius: 6px;
        cursor: pointer;
      `;
      btn.onclick = () => {
        selectPatient(a.patientId);
        navigate("patient-detail");
      };
      popupEl.append(time, name, addr, btn);
      popup.setContent(popupEl);
      marker.bindPopup(popup);
      markersRef.current.push(marker);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [filtered, selectPatient, navigate]);

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2 overflow-hidden">
        <div ref={mapRef} className="h-[480px] w-full" role="application" aria-label="Mapa de ruta de hoy" />
      </Card>

      <div className="space-y-3">
        <div>
          <Select value={filterProfId} onValueChange={setFilterProfId}>
            <SelectTrigger aria-label="Filtrar por terapeuta">
              <SelectValue placeholder="Todos los terapeutas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los terapeutas</SelectItem>
              {(professionals ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No hay citas programadas para hoy.
          </Card>
        ) : (
          <ol className="space-y-2">
            {filtered
              .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
              .map((a, idx) => (
                <li key={a.id}>
                  <Card
                    className="p-3 hover:shadow-md transition-shadow cursor-pointer"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      selectPatient(a.patientId);
                      navigate("patient-detail");
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                        style={{ backgroundColor: a.patientColor }}
                      >
                        {idx + 1}
                      </div>
                      <Avatar name={a.patientName} color={a.patientColor} size={36} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.patientName}</p>
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(a.start).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                          {" · "}
                          {a.type}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{a.patientAddress ?? "Sin dirección"}</p>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function startOfDayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}
function endOfDayISO() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
