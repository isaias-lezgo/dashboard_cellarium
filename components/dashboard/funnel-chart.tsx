"use client"

import { useMemo, useState } from "react"
import { Filter } from "lucide-react"
import type { Appointment, Call, Contact, Message, Opportunity, Pauta, Pipeline, Task } from "@/lib/types"
import { buildFunnel, type FunnelStep } from "@/lib/funnel"
import { panelStageOrder } from "@/lib/advisor-breakdown"
import { PANEL_SCOPES, scopeOpportunities, type PanelId } from "@/lib/panel-scope"
import { cn } from "@/lib/utils"
import {
  ChartCardContent,
  ChartCardHeader,
  ChartEmpty,
  ChartHint,
  DashboardCard,
  STATUS_COLORS,
  ScopePill,
} from "./dashboard-ui"
import { ChartDrillDrawer, DRILL_CLOSED, type DrillState } from "./chart-drill-drawer"

const pctFmt = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const n = (v: number) => v.toLocaleString("es-MX")

const STEP_COLOR: Record<FunnelStep["kind"], string> = {
  stage: STATUS_COLORS.abierta,
  won: STATUS_COLORS.ganada,
  lost: STATUS_COLORS.perdida,
}

export interface FunnelChartProps {
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
 * "Embudo de ventas": dónde está hoy cada lead del periodo. Una barra por etapa
 * de Ventas en orden de pipeline, y abajo Ganadas y Perdidas. El porcentaje es
 * sobre el total del periodo, perdidas incluidas: "el 2 % llegó a Meeting" solo
 * dice algo si el 56 % que se perdió está en el denominador.
 *
 * Barras en CSS y no en Recharts: ocho filas con etiqueta, conteo y porcentaje
 * se leen mejor como lista que como eje, y cada fila es un botón de drill-down.
 */
export function FunnelChart({
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
}: FunnelChartProps) {
  const [drill, setDrill] = useState<DrillState>(DRILL_CLOSED)
  const scope = PANEL_SCOPES[panel]

  const funnel = useMemo(
    () => buildFunnel(scopeOpportunities(opportunities, panel, pipelines), panelStageOrder(pipelines, panel)),
    [opportunities, panel, pipelines]
  )
  const max = useMemo(() => Math.max(1, ...funnel.steps.map((s) => s.count)), [funnel])
  const oppById = useMemo(() => new Map(allOpportunities.map((o) => [o.id, o])), [allOpportunities])

  const openDrill = (step: FunnelStep) => {
    const items = step.oppIds.map((id) => oppById.get(id)).filter((o): o is Opportunity => Boolean(o))
    if (items.length === 0) return
    setDrill({ open: true, title: step.label, subtitle: `Embudo ${scope.label}`, opportunities: items })
  }

  const stageSteps = funnel.steps.filter((s) => s.kind === "stage")
  const closedSteps = funnel.steps.filter((s) => s.kind !== "stage")

  const row = (step: FunnelStep) => (
    <button
      key={step.key}
      type="button"
      onClick={() => openDrill(step)}
      disabled={step.count === 0}
      title={step.count > 0 ? `Ver ${n(step.count)} oportunidades` : undefined}
      className={cn(
        "grid w-full grid-cols-[minmax(7rem,10rem)_1fr_3.5rem_3.5rem] items-center gap-3 rounded-md px-1 py-1 text-left text-xs",
        step.count > 0 ? "cursor-pointer hover:bg-muted/50" : "cursor-default"
      )}
    >
      <span className="truncate font-medium" title={step.label}>{step.label}</span>
      <span className="h-5 w-full overflow-hidden rounded-sm bg-muted/40">
        <span
          className="block h-full rounded-sm transition-[width] duration-300"
          style={{ width: `${(step.count / max) * 100}%`, backgroundColor: STEP_COLOR[step.kind] }}
          aria-hidden
        />
      </span>
      <span className="text-right font-mono tabular-nums">{n(step.count)}</span>
      <span className="text-right tabular-nums text-muted-foreground">{pctFmt.format(step.pct)}%</span>
    </button>
  )

  return (
    <DashboardCard>
      <ChartCardHeader
        title="Embudo de ventas"
        icon={Filter}
        total={funnel.total}
        actions={
          <ScopePill
            label="Foto de hoy · % del periodo"
            tooltip={
              <>
                Dónde está <strong>hoy</strong> cada oportunidad creada en el periodo. Una barra
                por etapa del embudo <strong>Ventas</strong>, más <strong>Ganadas</strong>{" "}
                (status won o etapa Cierre) y <strong>Perdidas</strong> (Leads Perdidos, o
                lost/abandoned). El porcentaje es sobre el total del periodo, perdidas
                incluidas. El CRM no guarda por qué etapas pasó cada lead, así que esto cuenta
                dónde están, no por dónde pasaron.
              </>
            }
          />
        }
      />
      <ChartCardContent>
        {funnel.total === 0 ? (
          <ChartEmpty message="Sin oportunidades en el periodo seleccionado" />
        ) : (
          <>
            <div className="space-y-0.5">{stageSteps.map(row)}</div>
            <div className="mt-3 space-y-0.5 border-t border-border pt-3">{closedSteps.map(row)}</div>
            <ChartHint>
              Foto del estado actual: una oportunidad cuenta en la etapa donde está hoy, no en
              las que recorrió. Clic en una barra abre sus oportunidades.
            </ChartHint>
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
