"use client"

import { useMemo, useState } from "react"
import { UserX } from "lucide-react"
import type { Appointment, Call, Contact, Message, Opportunity, Pauta, Task } from "@/lib/types"
import { KpiCard } from "./dashboard-ui"
import { ChartDrillDrawer, DRILL_CLOSED, type DrillState } from "./chart-drill-drawer"

export interface NoOpportunityCardProps {
  /** Contactos filtrados por fecha de creación. */
  contacts: Contact[]
  /**
   * Oportunidades CRUDAS, sin filtros de panel: un contacto cuya única
   * oportunidad quedó fuera de un filtro sigue teniendo oportunidad.
   */
  unfilteredOpportunities: Opportunity[]
  allOpportunities: Opportunity[]
  allContacts: Contact[]
  tasks?: Task[]
  calls?: Call[]
  allPautas?: Pauta[]
  appointments?: Appointment[]
  messages?: Message[]
  locationId?: string
}

/**
 * La fuga que ningún chart por-oportunidad puede ver: contactos que entraron al
 * CRM y nadie movió a un embudo. No pertenecen a ningún pipeline, así que van
 * FUERA de los agregados del panel y arriba de todo, con su propio drill-down.
 */
export function NoOpportunityCard({
  contacts,
  unfilteredOpportunities,
  allOpportunities,
  allContacts,
  tasks = [],
  calls = [],
  allPautas = [],
  appointments = [],
  messages = [],
  locationId = "",
}: NoOpportunityCardProps) {
  const [drill, setDrill] = useState<DrillState>(DRILL_CLOSED)

  const orphans = useMemo(() => {
    const withOpp = new Set(unfilteredOpportunities.map((o) => o.contactId))
    return contacts.filter((c) => !withOpp.has(c.id))
  }, [contacts, unfilteredOpportunities])

  const pct = contacts.length > 0 ? Math.round((orphans.length / contacts.length) * 100) : 0

  return (
    <>
      <KpiCard
        label="Contactos sin oportunidad"
        value={orphans.length.toLocaleString("es-MX")}
        sublabel={
          contacts.length > 0
            ? `${pct}% de ${contacts.length.toLocaleString("es-MX")} contactos del periodo · leads que nadie movió a un embudo`
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
