"use client";

import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Users, CalendarDays, FileText, Settings, Receipt,
  MapPin, ClipboardList, UserCog, ChevronLeft, ChevronRight, LogOut, Activity, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNav } from "@/store/nav";
import { useCenter } from "@/store/center";
import { RESOURCES } from "@/lib/schemas";
import { useCurrentSession } from "@/hooks/api";
import { Avatar } from "@/components/domain";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import type { View } from "@/types/domain";
import { useEffect } from "react";
import { ChevronsUpDown, Check } from "lucide-react";

type UserRole = "admin" | "therapist" | "guest";

interface NavItem {
  view: View;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Which roles can see this item. Omit = everyone. */
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { view: "dashboard", label: "Inicio", icon: LayoutDashboard },
  { view: "today", label: "Ruta de hoy", icon: MapPin, roles: ["admin", "therapist"] },
  { view: "patients", label: "Pacientes", icon: Users },
  { view: "calendar", label: "Agenda", icon: CalendarDays },
  { view: "reports", label: "Informes", icon: FileText, roles: ["admin", "therapist"] },
  { view: "equipo", label: "Equipo", icon: ClipboardList },
  { view: "facturacion", label: "Facturación", icon: Receipt, roles: ["admin"] },
  { view: "admin-users", label: "Gestión usuarios", icon: UserCog, roles: ["admin"] },
  { view: "settings", label: "Ajustes", icon: Settings },
];

export function Sidebar() {
  const { view, navigate, sidebarOpen, setSidebarOpen, sidebarCollapsed, setSidebarCollapsed } = useNav();
  const { user } = useCurrentSession();
  const { activeResource, setActiveResource, clearActiveResource } = useCenter();

  const userRole: UserRole = (user as { userRole?: UserRole } | undefined)?.userRole ?? (user?.isAdmin ? "admin" : "therapist");

  // Close on Escape
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen, setSidebarOpen]);

  const activeResourceConfig = RESOURCES.find((r) => r.key === activeResource);
  // "Ruta de hoy" only makes sense for centers with domiciliary visits to
  // plan a route between — hidden entirely (not just filtered) for centers
  // like "Asociación EM" where sessions happen in one place.
  const items = NAV_ITEMS
    .filter((it) => !it.roles || it.roles.includes(userRole))
    .filter((it) => it.view !== "today" || (activeResourceConfig?.hasRoutePlanning ?? true));

  // If the active center changes to one without route planning while the
  // person is looking at "Ruta de hoy", send them somewhere sensible
  // instead of leaving them on a nav item that just disappeared.
  useEffect(() => {
    if (view === "today" && activeResourceConfig && !activeResourceConfig.hasRoutePlanning) {
      navigate("dashboard");
    }
  }, [view, activeResourceConfig, navigate]);

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          "fixed lg:sticky top-0 z-40 lg:z-0 h-screen shrink-0 bg-sidebar text-sidebar-foreground",
          "flex flex-col transition-[width,transform] duration-200",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          sidebarCollapsed ? "w-64 lg:w-16" : "w-64",
        )}
        aria-label="Navegación principal"
      >
        {/* Brand */}
        <div className={cn(
          "flex items-center justify-between border-b border-sidebar-border py-4",
          sidebarCollapsed ? "px-3 lg:flex-col lg:gap-2 lg:py-4" : "px-5 py-5",
        )}>
          <div className={cn(
            "flex items-center gap-2.5",
            sidebarCollapsed && "lg:flex-col lg:gap-2",
          )}>
            <div className="w-9 h-9 rounded-lg bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className={cn(sidebarCollapsed && "lg:hidden")}>
              <p className="font-bold text-sm whitespace-nowrap">DomusGes</p>
              <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-wider whitespace-nowrap">Seguimiento</p>
            </div>

            {sidebarCollapsed && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="hidden lg:flex w-7 h-7 items-center justify-center rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                    onClick={() => setSidebarCollapsed(false)}
                    aria-label="Expandir menú"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Expandir menú</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Mobile close button */}
          <button
            className="lg:hidden text-sidebar-foreground/80 hover:text-sidebar-foreground"
            onClick={() => setSidebarOpen(false)}
            aria-label="Cerrar menú"
          >
            <X className="w-5 h-5" />
          </button>

          {!sidebarCollapsed && (
            <button
              className="hidden lg:flex w-7 h-7 items-center justify-center rounded-md text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Comprimir menú"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Centro activo */}
        <div className={cn("border-b border-sidebar-border p-3", sidebarCollapsed && "lg:px-2")}>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium",
                  "bg-sidebar-accent/60 text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
                  sidebarCollapsed && "lg:justify-center lg:px-0",
                )}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className={cn("flex-1 text-left truncate", sidebarCollapsed && "lg:hidden")}>
                  {activeResourceConfig?.label ?? "Elegir centro"}
                </span>
                <ChevronsUpDown className={cn("w-3.5 h-3.5 text-sidebar-foreground/50 shrink-0", sidebarCollapsed && "lg:hidden")} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground px-2 py-1">Centro de trabajo</p>
              {RESOURCES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setActiveResource(r.key)}
                  className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted transition-colors"
                >
                  {r.label}
                  {activeResource === r.key && <Check className="w-3.5 h-3.5 text-primary" />}
                </button>
              ))}
              <div className="border-t mt-1 pt-1">
                <button
                  onClick={clearActiveResource}
                  className="w-full text-left rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
                >
                  Volver a preguntar al entrar
                </button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Secciones">
          <ul className="space-y-1">
            {items.map((item) => {
              const active = view === item.view;
              const Icon = item.icon;
              const button = (
                <button
                  onClick={() => navigate(item.view)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    sidebarCollapsed && "lg:justify-center lg:px-0",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="w-4.5 h-4.5 shrink-0" />
                  <span className={cn("flex-1 text-left whitespace-nowrap", sidebarCollapsed && "lg:hidden")}>
                    {item.label}
                  </span>
                </button>
              );
              return (
                <li key={item.view}>
                  {sidebarCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{button}</TooltipTrigger>
                      <TooltipContent side="right" className="hidden lg:block">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    button
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User card + logout */}
        <div className="border-t border-sidebar-border p-3">
          <div className={cn("flex items-center gap-2.5 px-2 py-2", sidebarCollapsed && "lg:justify-center lg:px-0")}>
            <Avatar name={user?.name ?? "?"} size={36} />
            <div className={cn("flex-1 min-w-0", sidebarCollapsed && "lg:hidden")}>
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-[11px] text-sidebar-foreground/60 truncate">{user?.role}</p>
            </div>
          </div>
          {sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden lg:flex w-full mt-2 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  onClick={() => signOut({ redirect: false })}
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Cerrar sesión</TooltipContent>
            </Tooltip>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "w-full mt-2 justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              sidebarCollapsed && "lg:hidden",
            )}
            onClick={() => signOut({ redirect: false })}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </aside>
    </>
  );
}

export function SidebarToggle() {
  const { setSidebarOpen } = useNav();
  return (
    <button
      className="lg:hidden p-2 rounded-lg hover:bg-muted"
      onClick={() => setSidebarOpen(true)}
      aria-label="Abrir menú"
    >
      <ChevronLeft className="w-5 h-5 rotate-180" />
    </button>
  );
}
