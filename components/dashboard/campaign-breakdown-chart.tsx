"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Megaphone } from "lucide-react"
import type { Appointment, Call, Contact, Message, Opportunity, Pauta, Pipeline, Task } from "@/lib/types"
import { buildCampaignBreakdown, type CampaignRow } from "@/lib/campaign-breakdown"
import { STATUS_BUCKETS, STATUS_LABELS, type StatusBucket } from "@/lib/opportunity-breakdown"
import { PANEL_SCOPES, scopeOpportunities, type PanelId } from "@/lib/panel-scope"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import {
  CHART_GRID_STROKE,
  CHART_TICK,
  ChartCardContent,
  ChartCardHeader,
  ChartEmpty,
  DashboardCard,
  MissingAwareTick,
  NonZeroTooltipContent,
  STATUS_COLORS,
  ScopePill,
} from "./dashboard-ui"
import { ChartDrillDrawer, DRILL_CLOSED, type DrillState } from "./chart-drill-drawer"

const chartConfig = {
  ganada: { label: STATUS_LABELS.ganada, color: STATUS_COLORS.ganada },
  abierta: { label: STATUS_LABELS.abierta, color: STATUS_COLORS.abierta },
  perdida: { label: STATUS_LABELS.perdida, color: STATUS_COLORS.perdida },
}

/** Los nombres de campaña de Meta son largos; el completo sigue en el tooltip. */
const MAX_TICK = 34
const shortLabel = (v: string) => (v.length > MAX_TICK ? v.slice(0, MAX_TICK - 1) + "…" : v)

export interface CampaignBreakdownChartProps {
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
 * "Leads por campaña": qué campaña de Meta trajo cuántos leads y en qué
 * terminaron. Barras horizontales por volumen, apiladas por estatus con los
 * mismos colores y la misma cubeta que "Oportunidades por estado".
 */
export function CampaignBreakdownChart({
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
}: CampaignBreakdownChartProps) {
  const [drill, setDrill] = useState<DrillState>(DRILL_CLOSED)
  const scope = PANEL_SCOPES[panel]

  const rows = useMemo(
    () => buildCampaignBreakdown(scopeOpportunities(opportunities, panel, pipelines)),
    [opportunities, panel, pipelines]
  )
  const total = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows])
  const oppById = useMemo(() => new Map(allOpportunities.map((o) => [o.id, o])), [allOpportunities])

  const openDrill = (row: CampaignRow, bucket: StatusBucket) => {
    const items = row.ids[bucket].map((id) => oppById.get(id)).filter((o): o is Opportunity => Boolean(o))
    if (items.length === 0) return
    setDrill({
      open: true,
      title: `${row.label} — ${STATUS_LABELS[bucket]}`,
      subtitle: `Leads por campaña · ${scope.label}`,
      opportunities: items,
    })
  }

  const height = Math.max(160, rows.length * 36 + 24)

  return (
    <DashboardCard>
      <ChartCardHeader
        title="Leads por campaña"
        icon={Megaphone}
        total={total}
        actions={
          <ScopePill
            label="Campaña de Meta · por estatus"
            tooltip={
              <>
                Oportunidades del periodo agrupadas por la <strong>campaña</strong> de Meta
                que las trajo (la primera atribución de la oportunidad), partidas en ganadas,
                abiertas y perdidas con la misma regla que &ldquo;Oportunidades por
                estado&rdquo;. <strong>Sin campaña</strong> junta los leads que llegaron sin UTM de
                campaña —mensajes directos de Facebook, Instagram y WhatsApp sin anuncio
                rastreable, importaciones y captura manual— y son ~4 de cada 10.
              </>
            }
          />
        }
      />
      <ChartCardContent>
        {total === 0 ? (
          <ChartEmpty message="Sin oportunidades en el periodo seleccionado" />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              {STATUS_BUCKETS.map((bucket) => (
                <span key={bucket} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: STATUS_COLORS[bucket] }}
                    aria-hidden
                  />
                  {STATUS_LABELS[bucket]}
                </span>
              ))}
            </div>
            <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                barCategoryGap={8}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_GRID_STROKE} />
                <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={210}
                  tick={<MissingAwareTick />}
                  tickFormatter={shortLabel}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />
                <ChartTooltip content={<NonZeroTooltipContent />} />
                {STATUS_BUCKETS.map((bucket, i) => (
                  <Bar
                    key={bucket}
                    dataKey={bucket}
                    stackId="campana"
                    fill={STATUS_COLORS[bucket]}
                    radius={i === STATUS_BUCKETS.length - 1 ? [0, 3, 3, 0] : undefined}
                    cursor="pointer"
                    onClick={(payload: { key?: string }) => {
                      const row = rows.find((r) => r.key === payload?.key)
                      if (row) openDrill(row, bucket)
                    }}
                  />
                ))}
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
