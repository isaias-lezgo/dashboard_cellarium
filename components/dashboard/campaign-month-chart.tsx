"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts"
import { CalendarRange } from "lucide-react"
import type { Appointment, Call, Contact, Message, Opportunity, Pauta, Pipeline, Task } from "@/lib/types"
import { campaignOf, NO_CAMPAIGN_LABEL } from "@/lib/cellarium-rules"
import { buildMonthSeries, type SeriesEntry } from "@/lib/month-series"
import { PANEL_SCOPES, scopeOpportunities, type PanelId } from "@/lib/panel-scope"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import {
  CHART_GRID_STROKE,
  CHART_TICK,
  ChartCardContent,
  ChartCardHeader,
  ChartEmpty,
  DashboardCard,
  MISSING_TEXT,
  MissingAwareTick,
  NonZeroTooltipContent,
  SERIES_NEUTRALS,
  SERIES_PALETTE,
  ScopePill,
} from "./dashboard-ui"
import { ChartDrillDrawer, DRILL_CLOSED, type DrillState } from "./chart-drill-drawer"

const n = (v: number) => v.toLocaleString("es-MX")
const TOTAL_ANCHOR = "__total"
// Recharts sí acepta un arreglo de radios por esquina en Cell, pero su tipo
// declara number; el cast es el mismo que usaba lost-by-dimension-chart.
const TOP_RADIUS = [3, 3, 0, 0] as unknown as number

/** Slot sintético por serie: sirve de dataKey y de nombre de variable CSS. */
function slotOf(entry: SeriesEntry, namedIndex: number): string {
  if (entry.kind === "otros") return "otros"
  if (entry.kind === "empty") return "vacio"
  return `s${namedIndex}`
}
function colorOf(slot: string): { light: string; dark: string } {
  if (slot === "otros") return SERIES_NEUTRALS.otros
  if (slot === "vacio") return SERIES_NEUTRALS.empty
  const i = Number(slot.slice(1))
  return { light: SERIES_PALETTE.light[i], dark: SERIES_PALETTE.dark[i] }
}

export interface CampaignMonthChartProps {
  panel: PanelId
  opportunities: Opportunity[]
  allOpportunities: Opportunity[]
  contacts: Contact[]
  allContacts: Contact[]
  pipelines?: Pipeline[]
  tasks?: Task[]
  calls?: Call[]
  allPautas?: Pauta[]
  appointments?: Appointment[]
  messages?: Message[]
  locationId?: string
}

/**
 * "Leads por campaña y mes": cuándo entró cada campaña. Barras apiladas por mes
 * de creación, una serie por campaña, con la cola larga plegada en "Otros" y
 * "Sin campaña" en gris al final. Series y colores se deciden sobre el set SIN
 * filtrar para que el filtro de fechas no las repinte.
 */
export function CampaignMonthChart({
  panel,
  opportunities,
  allOpportunities,
  contacts,
  allContacts,
  pipelines = [],
  tasks = [],
  calls = [],
  allPautas = [],
  appointments = [],
  messages = [],
  locationId = "",
}: CampaignMonthChartProps) {
  const [drill, setDrill] = useState<DrillState>(DRILL_CLOSED)
  const [isolated, setIsolated] = useState<string | null>(null)
  const scope = PANEL_SCOPES[panel]

  const scoped = useMemo(
    () => scopeOpportunities(opportunities, panel, pipelines),
    [opportunities, panel, pipelines]
  )
  const scopedAll = useMemo(
    () => scopeOpportunities(allOpportunities, panel, pipelines),
    [allOpportunities, panel, pipelines]
  )

  const dimOpts = useMemo(() => ({ dimensionOf: campaignOf, emptyLabel: NO_CAMPAIGN_LABEL }), [])

  // Qué series existen y de qué color son se decide UNA vez, sobre el set SIN
  // filtrar: mover el filtro de fechas no debe repintar las series.
  const { slotByKey, namedKeys } = useMemo(() => {
    const all = buildMonthSeries(scopedAll, dimOpts)
    const map = new Map<string, string>()
    const names: string[] = []
    let named = 0
    for (const s of all.series) {
      if (s.kind === "named") names.push(s.key)
      map.set(s.key, slotOf(s, s.kind === "named" ? named++ : 0))
    }
    return { slotByKey: map, namedKeys: names }
  }, [scopedAll, dimOpts])

  const data = useMemo(
    () => buildMonthSeries(scoped, { ...dimOpts, namedKeys }),
    [scoped, dimOpts, namedKeys]
  )

  const slots = useMemo(
    () => data.series.map((s) => ({ entry: s, slot: slotByKey.get(s.key) ?? "otros" })),
    [data.series, slotByKey]
  )
  const labelOf = (entry: SeriesEntry) =>
    entry.kind === "otros" ? `Otros (${entry.foldedCount})` : entry.label

  const config: ChartConfig = useMemo(() => {
    const out: ChartConfig = {}
    for (const { entry, slot } of slots) out[slot] = { label: labelOf(entry), theme: colorOf(slot) }
    return out
  }, [slots])

  // Filas planas para Recharts: una por mes, un dataKey por slot. Las series sin
  // valor en un mes se dejan AUSENTES, no en cero: un cero mete un rectángulo de
  // altura 0 en el stack y desordena el cálculo de topSlotByRow.
  const rows = useMemo(
    () =>
      data.buckets.map((b) => {
        const row: Record<string, string | number> = { label: b.label, total: b.total, [TOTAL_ANCHOR]: 0 }
        for (const { entry, slot } of slots) {
          const v = b.values[entry.key]
          if (v) row[slot] = v
        }
        return row
      }),
    [data.buckets, slots]
  )
  // El slot más alto de cada fila lleva las esquinas redondeadas.
  const topSlotByRow = useMemo(
    () => rows.map((row) => [...slots].reverse().find(({ slot }) => row[slot])?.slot),
    [rows, slots]
  )

  const oppById = useMemo(() => new Map(allOpportunities.map((o) => [o.id, o])), [allOpportunities])
  const openDrill = (seriesKey: string, rowIndex: number) => {
    const bucket = data.buckets[rowIndex]
    const ids = bucket?.oppIds[seriesKey] ?? []
    const items = ids.map((id) => oppById.get(id)).filter((o): o is Opportunity => Boolean(o))
    if (items.length === 0) return
    const entry = data.series.find((s) => s.key === seriesKey)
    setDrill({
      open: true,
      title: `${bucket.label} — ${entry ? labelOf(entry) : seriesKey}`,
      subtitle: `Leads por campaña y mes · ${scope.label}`,
      opportunities: items,
    })
  }

  // ChartStyle emite --color-<slot> bajo [data-chart=chart-<id>]; la leyenda
  // vive FUERA del ChartContainer y necesita el mismo data-chart.
  const chartId = `campana-mes-${panel}`

  return (
    <DashboardCard>
      <ChartCardHeader
        title="Leads por campaña y mes"
        icon={CalendarRange}
        total={data.grandTotal}
        actions={
          <ScopePill
            label="Por mes de creación"
            tooltip={
              <>
                Oportunidades por el mes en que se crearon, apiladas por la{" "}
                <strong>campaña</strong> de Meta que las trajo. Las cinco campañas mayores
                llevan nombre propio; el resto se pliega en <strong>Otros</strong>.{" "}
                <strong>Sin campaña</strong> son los leads sin UTM: mensajes directos de
                Facebook, Instagram y WhatsApp, importaciones y captura manual. Los colores
                se fijan sobre todo el historial para que el filtro de fechas no los cambie.
                Clic en un nombre de la leyenda lo aísla.
              </>
            }
          />
        }
      />
      <ChartCardContent>
        {data.grandTotal === 0 ? (
          <ChartEmpty message="Sin oportunidades en el periodo seleccionado" />
        ) : (
          <>
            <div
              data-chart={`chart-${chartId}`}
              className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1"
            >
              {slots.map(({ entry, slot }) => {
                const dimmed = isolated !== null && isolated !== slot
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setIsolated(isolated === slot ? null : slot)}
                    className={cn(
                      "inline-flex min-w-0 max-w-[14rem] items-center gap-1.5 text-[11px] text-muted-foreground transition-opacity",
                      dimmed && "opacity-40"
                    )}
                    title={`${entry.label} · ${n(entry.total)}`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-sm"
                      style={{ backgroundColor: `var(--color-${slot})` }}
                      aria-hidden
                    />
                    <span className={cn("truncate", entry.kind === "empty" && MISSING_TEXT)}>
                      {labelOf(entry)}
                    </span>
                  </button>
                )
              })}
            </div>
            <ChartContainer id={chartId} config={config} className="h-[280px] w-full">
              <BarChart data={rows} margin={{ top: 24, right: 8, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID_STROKE} />
                <XAxis
                  dataKey="label"
                  tick={<MissingAwareTick />}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={12}
                />
                <YAxis
                  tick={CHART_TICK}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  tickFormatter={(v: number) => n(v)}
                  allowDecimals={false}
                />
                <ChartTooltip
                  content={
                    <NonZeroTooltipContent
                      formatter={(value, name) => (
                        <div className="flex w-full items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: `var(--color-${name})` }}
                            aria-hidden
                          />
                          <span className="flex-1 truncate text-muted-foreground">
                            {config[String(name)]?.label ?? name}
                          </span>
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            {n(Number(value))}
                          </span>
                        </div>
                      )}
                    />
                  }
                />
                {slots.map(({ entry, slot }) => (
                  <Bar
                    key={slot}
                    dataKey={slot}
                    stackId="campana"
                    fill={`var(--color-${slot})`}
                    onClick={(_: unknown, index: number) => openDrill(entry.key, index)}
                    className="cursor-pointer"
                  >
                    {rows.map((_, rowIndex) => {
                      const dimmed = isolated !== null && isolated !== slot
                      return (
                        <Cell
                          key={rowIndex}
                          fillOpacity={dimmed ? 0.18 : 1}
                          radius={topSlotByRow[rowIndex] === slot ? TOP_RADIUS : undefined}
                        />
                      )
                    })}
                  </Bar>
                ))}
                <Bar dataKey={TOTAL_ANCHOR} stackId="campana" fill="transparent">
                  <LabelList
                    dataKey="total"
                    position="top"
                    offset={8}
                    className="fill-muted-foreground"
                    fontSize={10}
                    formatter={(v: number) => n(v)}
                  />
                </Bar>
              </BarChart>
            </ChartContainer>
          </>
        )}
      </ChartCardContent>
      <ChartDrillDrawer
        drill={drill}
        onDrillChange={setDrill}
        contacts={allContacts.length > 0 ? allContacts : contacts}
        tasks={tasks}
        calls={calls}
        allOpportunities={allOpportunities}
        allPautas={allPautas}
        appointments={appointments}
        messages={messages}
        locationId={locationId}
      />
    </DashboardCard>
  )
}
