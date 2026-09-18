"use client"

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import { useTheme } from "next-themes"
import { AnimatePresence } from "framer-motion"
import { CellariumDashboard } from "@/components/dashboard/cellarium-dashboard"
import { DateRangeFilter } from "@/components/dashboard/date-range-filter"
import { filterByDateRange, resolveDateRange, type DateFilter } from "@/lib/date-range"
import {
  ActiveFiltersPill,
  MultiSelectFilter,
  type MultiSelectOption,
} from "@/components/dashboard/multi-select-filter"
import {
  activeFilterCount,
  ADVISORS,
  advisorKeyOf,
  applyPanelFilters,
  campaignOptions,
  EMPTY_PANEL_FILTERS,
  type PanelFilters,
} from "@/lib/panel-filters"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ConversationsChat } from "@/components/dashboard/conversations-chat"
import { LoadingScreen } from "@/components/dashboard/loading-screen"
import { SyncWarningBanner } from "@/components/dashboard/sync-warning-banner"
import { useDashboardData } from "@/hooks/use-dashboard-data"
import { useConversationsData } from "@/hooks/use-conversations-data"
import { useConversationActivity } from "@/hooks/use-conversation-activity"
import {
  Megaphone,
  UserRound,
  Warehouse,
  RefreshCw,
  Loader2,
  AlertCircle,
  Sun,
  Moon,
  Users,
  Target,
  ClipboardList,
  Sparkles,
  LogOut,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Un solo negocio, un solo panel, más el asistente.
type DashboardTab = "cellarium" | "conversations"

// Browser-tab title per view. The app is a single route, so the title is set
// imperatively — `metadata` in layout.tsx can only give one static fallback.
const TAB_TITLES: Record<DashboardTab, string> = {
  cellarium: "Cellarium - Lezgo Suite CRM",
  conversations: "Asistente IA - Lezgo Suite CRM",
}

/**
 * Antigüedad en tiempo relativo. El panel se sirve de un caché en Postgres, así
 * que lo que está en pantalla puede tener minutos u horas: una hora de reloj
 * ("Actualizado 09:14") no dice si eso es de hoy temprano o de anteayer, y un
 * caché sin antigüedad visible miente por omisión.
 *
 * `_tick` no se usa dentro: existe solo para que React vuelva a llamar a esta
 * función cada minuto (ver el intervalo en el componente).
 */
function relativeAge(fetchedAt: string, _tick: number): string {
  const mins = Math.floor((Date.now() - new Date(fetchedAt).getTime()) / 60000)
  if (mins < 1) return "hace un momento"
  if (mins === 1) return "hace 1 minuto"
  if (mins < 60) return `hace ${mins} minutos`
  const hrs = Math.floor(mins / 60)
  if (hrs === 1) return "hace 1 hora"
  if (hrs < 24) return `hace ${hrs} horas`
  const days = Math.floor(hrs / 24)
  return days === 1 ? "hace 1 día" : `hace ${days} días`
}

export default function DashboardPage() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<DashboardTab>("cellarium")
  // El texto "Actualizado hace X" es relativo, así que tiene que re-renderizarse
  // solo; nada más en la página cambia para obligarlo.
  const [nowTick, setNowTick] = useState(0)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { document.title = TAB_TITLES[activeTab] }, [activeTab])

  const {
    data,
    isLoading,
    isError,
    progress,
    locationName,
    steps,
    elapsedMs,
    stalled,
    liveSync,
    refresh,
  } = useDashboardData({})
  const { messages } = useConversationsData()
  // Actividad de conversaciones para la matriz de abandono. Va aparte del sync
  // principal (es un recorrido de miles de conversaciones) y su ESTADO viaja
  // con ella: con el mapa vacío la matriz acusaría abandono total.
  const {
    activity: conversationActivity,
    status: activityStatus,
    progress: activityProgress,
    refresh: refreshActivity,
  } = useConversationActivity()

  const [dateFilter, setDateFilter] = useState<DateFilter>({ preset: "all" })
  const dateRange = useMemo(() => resolveDateRange(dateFilter), [dateFilter])

  // Los dos filtros de alcance: asesor y campaña. Se aplican aquí, sobre el set
  // crudo y antes del corte por fecha: las slices filtradas y los sets `all*`
  // que resuelven los drill-downs tienen que ver el mismo universo.
  const [panelFilters, setPanelFilters] = useState<PanelFilters>(EMPTY_PANEL_FILTERS)
  const rawOpportunities = useMemo(() => data?.opportunities ?? [], [data?.opportunities])
  const scopedOpportunities = useMemo(
    () => applyPanelFilters(rawOpportunities, panelFilters),
    [rawOpportunities, panelFilters]
  )

  // Las opciones y sus conteos se calculan SIN los filtros de panel puestos: si
  // se calcularan sobre el set ya filtrado, elegir una campaña dejaría el menú
  // con una sola opción y sin manera de agregar otra.
  const asesorOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const o of rawOpportunities) {
      const key = advisorKeyOf(o)
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return ADVISORS.map((a) => ({ value: a.key, label: a.label, count: counts.get(a.key) ?? 0 }))
  }, [rawOpportunities])

  const campanaOptions = useMemo(() => campaignOptions(rawOpportunities), [rawOpportunities])

  // Human label of the active date filter, for the PDF report cover.
  const periodLabel = useMemo(() => {
    const base = (() => {
      switch (dateFilter.preset) {
        case "week": return "Últimos 7 días"
        case "month": return "Últimos 30 días"
        case "3m": return "Últimos 3 meses"
        case "6m": return "Últimos 6 meses"
        case "custom":
          if (!dateRange) return "Todo el historial"
          return `${format(dateRange.from, "d MMM yyyy", { locale: es })} – ${format(dateRange.to, "d MMM yyyy", { locale: es })}`
        default: return "Todo el historial"
      }
    })()

    // El alcance del reporte incluye los filtros de la barra, no solo la fecha:
    // una portada que calla que el panel está recortado es una portada que miente.
    const parts = [base]
    if (panelFilters.asesores.length) {
      const names = panelFilters.asesores.map((k) => ADVISORS.find((a) => a.key === k)?.label ?? k)
      parts.push(`Asesor: ${names.join(", ")}`)
    }
    if (panelFilters.campanas.length) parts.push(`Campaña: ${panelFilters.campanas.join(", ")}`)
    return parts.join(" · ")
  }, [dateFilter.preset, dateRange, panelFilters])

  const contacts = useMemo(
    () => filterByDateRange(data?.contacts ?? [], (c) => c.createdAt, dateRange),
    [data?.contacts, dateRange]
  )
  const opportunities = useMemo(
    () => filterByDateRange(scopedOpportunities, (o) => o.createdAt, dateRange),
    [scopedOpportunities, dateRange]
  )
  const calls = useMemo(
    () => filterByDateRange(data?.calls ?? [], (c) => c.createdAt, dateRange),
    [data?.calls, dateRange]
  )
  const appointments = useMemo(
    () => filterByDateRange(data?.appointments ?? [], (a) => a.startTime, dateRange),
    [data?.appointments, dateRange]
  )
  const tasks = useMemo(
    () => filterByDateRange(data?.tasks ?? [], (t) => t.createdAt ?? t.dueDate, dateRange),
    [data?.tasks, dateRange]
  )
  const pautas = useMemo(
    () => filterByDateRange(data?.pautas ?? [], (p) => p.createdAt, dateRange),
    [data?.pautas, dateRange]
  )
  const filteredMessages = useMemo(
    () => filterByDateRange(messages, (m) => m.createdAt, dateRange),
    [messages, dateRange]
  )
  const availableMembers = data?.members ?? []
  const availableTags = data?.tags ?? []

  const isInitialLoad = isLoading && !data

  return (
    <>
    <AnimatePresence>
      {isInitialLoad && (
        <LoadingScreen
          key="loader"
          progress={progress}
          locationName={locationName}
          steps={steps}
          elapsedMs={elapsedMs}
          stalled={stalled}
          liveSync={liveSync}
        />
      )}
    </AnimatePresence>
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-[#335577]/20 bg-[#0D172F] px-4 py-3 text-white shadow-none sm:px-6 sm:py-3.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-3">
            <Image
              src="/logo-mark.png"
              alt="Lezgo Suite"
              width={2851}
              height={3371}
              priority
              className="h-9 w-auto shrink-0"
            />
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-semibold leading-tight tracking-tight">Lezgo Suite Analíticas</h1>
            </div>
            {locationName && (
              <>
                <span aria-hidden className="hidden h-6 w-px shrink-0 bg-white/15 sm:block" />
                <span className="hidden min-w-0 max-w-[220px] truncate text-[13px] font-medium text-white/80 sm:inline-block">
                  {locationName}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
            {isError && (
              <div className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                Error al cargar datos
              </div>
            )}
            {!isLoading && data && (
              <TooltipProvider delayDuration={200}>
                <div className="flex items-center gap-1.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex cursor-default items-center gap-1 rounded-md border border-white/15 bg-white/[0.07] px-2 py-1 text-[11px] font-medium tabular-nums text-white">
                        <Users className="h-3 w-3 text-white/45" />
                        {data.contacts.length.toLocaleString("es-MX")}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Contactos cargados</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex cursor-default items-center gap-1 rounded-md border border-white/15 bg-white/[0.07] px-2 py-1 text-[11px] font-medium tabular-nums text-white">
                        <Target className="h-3 w-3 text-white/45" />
                        {data.opportunities.length.toLocaleString("es-MX")}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Oportunidades cargadas</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex cursor-default items-center gap-1 rounded-md border border-white/15 bg-white/[0.07] px-2 py-1 text-[11px] font-medium tabular-nums text-white">
                        <ClipboardList className="h-3 w-3 text-white/45" />
                        {(data?.pautas ?? []).length.toLocaleString("es-MX")}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Pautas cargadas</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            )}
            <span className="hidden text-[11px] tabular-nums text-white/55 sm:inline">
              {isLoading
                ? (progress || "Sincronizando…")
                : data?.meta?.fetchedAt
                  ? `Actualizado ${relativeAge(data.meta.fetchedAt, nowTick)}`
                  : ""}
            </span>
            
           
            <Button
              variant="default"
              size="sm"
              className="h-8 gap-1.5 rounded-lg text-xs font-medium"
              onClick={() => refresh()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Actualizar</span>
            </Button>
            
            {isLoading && <Loader2 className="h-4 w-4 animate-spin text-white/80" />}

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Cambiar tema"
            >
              {mounted && resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" })
                // A full page load, not a router push: this drops all client-side
                // dashboard state, so the next client to log in on this browser
                // can't see the previous client's data behind a cached React tree.
                window.location.href = "/login"
              }}
              aria-label="Cerrar sesión"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {data?.warnings && data.warnings.length > 0 && (
        <SyncWarningBanner
          warnings={data.warnings}
          onRetry={() => refresh()}
          isLoading={isLoading}
        />
      )}

      <nav className="border-b border-border bg-card px-4 sm:px-6" aria-label="Vistas del panel">
        <div className="flex gap-6 sm:gap-8">
          {(
            [
              { id: "cellarium" as const, label: "Cellarium", icon: Warehouse, mark: null },
              { id: "conversations" as const, label: "Asistente IA", icon: Sparkles, mark: null },
            ] as const
          ).map(({ id, label, icon: Icon, mark }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={cn(
                  "relative flex items-center gap-2 py-3 text-sm font-medium transition-colors duration-200",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {mark ? (
                  <Image
                    src={mark}
                    alt=""
                    width={60}
                    height={60}
                    aria-hidden
                    className={cn(
                      "h-4 w-4 shrink-0 object-contain transition-opacity duration-200",
                      active ? "opacity-100" : "opacity-60",
                    )}
                  />
                ) : (
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                )}
                {label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
                )}
              </button>
            )
          })}
        </div>
      </nav>

      {activeTab !== "conversations" && (
        <DateRangeFilter
          value={dateFilter}
          onChange={setDateFilter}
          filters={
            <>
              <MultiSelectFilter
                label="Asesor"
                icon={UserRound}
                options={asesorOptions}
                selected={panelFilters.asesores}
                onChange={(asesores) => setPanelFilters((f) => ({ ...f, asesores }))}
              />
              <MultiSelectFilter
                label="Campaña"
                icon={Megaphone}
                options={campanaOptions}
                selected={panelFilters.campanas}
                onChange={(campanas) => setPanelFilters((f) => ({ ...f, campanas }))}
                emptyMessage="Ninguna oportunidad trae campaña"
                searchable
              />
              <ActiveFiltersPill
                count={activeFilterCount(panelFilters)}
                onClear={() => setPanelFilters(EMPTY_PANEL_FILTERS)}
              />
            </>
          }
        />
      )}

      {/* Dashboard Content */}
      <div className="flex-1 pt-2 pb-6">
        {/* El panel recibe las slices filtradas por fecha para dibujar, más los
            sets `all*` sin filtrar como tablas de lookup para los drill-downs. */}
        {activeTab === "cellarium" && (
          <CellariumDashboard
            opportunities={opportunities}
            allOpportunities={scopedOpportunities}
            contacts={contacts}
            allContacts={data?.contacts ?? []}
            pautas={pautas}
            allPautas={data?.pautas ?? []}
            pipelines={data?.pipelines ?? []}
            tasks={tasks}
            allTasks={data?.tasks ?? []}
            unfilteredOpportunities={data?.opportunities ?? []}
            conversationActivity={conversationActivity}
            activityStatus={activityStatus}
            activityProgress={activityProgress}
            onRetryActivity={refreshActivity}
            calls={calls}
            messages={filteredMessages}
            allMessages={messages}
            appointments={appointments}
            allAppointments={data?.appointments ?? []}
            members={availableMembers}
            locationId={data?.locationId ?? ""}
            locationName={locationName ?? undefined}
            periodLabel={periodLabel}
            dateRange={dateRange}
          />
        )}
        {/* Kept permanently mounted (hidden when inactive) so the AI chat
            history survives switching to the Cellarium tab. */}
        {/* The AI assistant always sees the full (unfiltered) dataset — the
            date filter bar is hidden on this tab. */}
        <div className={cn(activeTab !== "conversations" && "hidden")}>
          <ConversationsChat
            dataset={{
              contacts: data?.contacts ?? [],
              opportunities: data?.opportunities ?? [],
              pautas: data?.pautas ?? [],
              appointments: data?.appointments ?? [],
              messages,
              tasks: data?.tasks ?? [],
              calls: data?.calls ?? [],
            }}
            locationId={data?.locationId}
          />
        </div>
      </div>
    </div>
    </>
  )
}
