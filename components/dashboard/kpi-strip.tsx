"use client"

import { useMemo, useState } from "react"
import { Activity, Target, TrendingDown, Trophy, UserMinus, UserX } from "lucide-react"
import type { Appointment, Call, Contact, Message, Opportunity, Pauta, Pipeline, Task } from "@/lib/types"
import { statusBucket, type StatusBucket } from "@/lib/opportunity-breakdown"
import { PANEL_SCOPES, scopeOpportunities, type PanelId } from "@/lib/panel-scope"
import { KpiCard } from "./dashboard-ui"
import { ChartDrillDrawer, DRILL_CLOSED, type DrillState } from "./chart-drill-drawer"

const n = (v: number) => v.toLocaleString("es-MX")
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "0%")

export interface KpiStripProps {
  panel: PanelId
  /** Oportunidades ya filtradas por fecha y por los filtros del panel. */
  opportunities: Opportunity[]
  allOpportunities: Opportunity[]
  /** Contactos filtrados por fecha de creación. */
  contacts: Contact[]
  allContacts: Contact[]
  /**
   * Oportunidades CRUDAS, sin filtros de panel: un contacto cuya única
   * oportunidad quedó fuera de un filtro sigue teniendo oportunidad.
   */
  unfilteredOpportunities: Opportunity[]
  pipelines?: Pipeline[]
  tasks?: Task[]
  calls?: Call[]
  allPautas?: Pauta[]
  appointments?: Appointment[]
  messages?: Message[]
  locationId?: string
}

/**
 * Los números de cabecera del periodo, con las MISMAS reglas que los charts de
 * abajo (statusBucket, scope de los dos pipelines): si una tarjeta y una barra
 * dicen cosas distintas, el panel pierde la confianza de dirección en un
 * vistazo. Cada tarjeta abre su drill-down.
 *
 * "Contactos sin oportunidad" es la excepción: no pertenece a ningún pipeline
 * y se cuenta contra el set CRUDO, para que un filtro de asesor no fabrique
 * huérfanos.
 */
export function KpiStrip({
  panel,
  opportunities,
  allOpportunities,
  contacts,
  allContacts,
  unfilteredOpportunities,
  pipelines = [],
  tasks = [],
  calls = [],
  allPautas = [],
  appointments = [],
  messages = [],
  locationId = "",
}: KpiStripProps) {
  const [drill, setDrill] = useState<DrillState>(DRILL_CLOSED)
  const scope = PANEL_SCOPES[panel]

  const scoped = useMemo(
    () => scopeOpportunities(opportunities, panel, pipelines),
    [opportunities, panel, pipelines]
  )

  const buckets = useMemo(() => {
    const out: Record<StatusBucket, Opportunity[]> = { ganada: [], abierta: [], perdida: [] }
    for (const o of scoped) out[statusBucket(o)].push(o)
    return out
  }, [scoped])

  const unassigned = useMemo(() => scoped.filter((o) => !(o.assignedTo ?? "").trim()), [scoped])

  const orphans = useMemo(() => {
    const withOpp = new Set(unfilteredOpportunities.map((o) => o.contactId))
    return contacts.filter((c) => !withOpp.has(c.id))
  }, [contacts, unfilteredOpportunities])

  const total = scoped.length

  const openOpps = (title: string, items: Opportunity[], subtitle: string) => {
    if (items.length === 0) return
    setDrill({ open: true, title, subtitle, opportunities: items })
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Leads del periodo"
          value={n(total)}
          sublabel="oportunidades creadas · Ventas y Leads Perdidos"
          icon={Target}
          onClick={() => openOpps("Leads del periodo", scoped, `Todas las oportunidades · ${scope.label}`)}
        />
        <KpiCard
          label="Abiertas"
          value={n(buckets.abierta.length)}
          sublabel={`${pct(buckets.abierta.length, total)} de los leads · en juego en Ventas`}
          icon={Activity}
          onClick={() => openOpps("Abiertas", buckets.abierta, "Ni ganadas ni perdidas")}
        />
        <KpiCard
          label="Ganadas"
          value={n(buckets.ganada.length)}
          sublabel={`${pct(buckets.ganada.length, total)} de los leads · status won o etapa Cierre`}
          icon={Trophy}
          onClick={() => openOpps("Ganadas", buckets.ganada, "Status won o etapa Cierre")}
        />
        <KpiCard
          label="Perdidas"
          value={n(buckets.perdida.length)}
          sublabel={`${pct(buckets.perdida.length, total)} de los leads · en Leads Perdidos`}
          icon={TrendingDown}
          onClick={() => openOpps("Perdidas", buckets.perdida, "Leads Perdidos, o marcadas perdidas en Ventas")}
        />
        <KpiCard
          label="Sin asesor"
          value={n(unassigned.length)}
          sublabel={`${pct(unassigned.length, total)} de los leads · nadie las tiene asignadas`}
          icon={UserMinus}
          onClick={() => openOpps("Sin asesor", unassigned, "Oportunidades sin assignedTo")}
        />
        <KpiCard
          label="Contactos sin oportunidad"
          value={n(orphans.length)}
          sublabel={
            contacts.length > 0
              ? `${pct(orphans.length, contacts.length)} de ${n(contacts.length)} contactos · nadie los movió a un embudo`
              : "Sin contactos en el periodo"
          }
          icon={UserX}
          onClick={() =>
            orphans.length > 0 &&
            setDrill({
              open: true,
              title: "Contactos sin oportunidad",
              subtitle: "Creados en el periodo, sin ninguna oportunidad en el CRM",
              opportunities: [],
              contactItems: orphans,
            })
          }
        />
      </div>
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
    </>
  )
}
