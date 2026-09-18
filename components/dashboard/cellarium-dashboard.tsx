"use client"

import type {
  Opportunity,
  Contact,
  Pauta,
  Task,
  Call,
  Appointment,
  Pipeline,
  Message,
} from "@/lib/types"
import type { ResolvedDateRange } from "@/lib/date-range"
import type {
  ActivityProgress,
  ActivityStatus,
} from "@/hooks/use-conversation-activity"
import { DashboardShell, SectionHeader } from "./dashboard-ui"
import { FunnelChart } from "./funnel-chart"
import { OpportunityStatusChart } from "./opportunity-status-chart"
import { AdvisorStageTable } from "./advisor-stage-table"
import { CampaignBreakdownChart } from "./campaign-breakdown-chart"
import { CampaignMonthChart } from "./campaign-month-chart"
import { AssignmentFunnelChart } from "./assignment-funnel-chart"
import { StaleOpportunityMatrix } from "./stale-opportunity-matrix"
import { LostReasonMatrix } from "./lost-reason-matrix"
import { KpiStrip } from "./kpi-strip"

/**
 * El panel de Cellarium: un solo negocio sobre los dos pipelines de la cuenta
 * (Ventas ∪ Leads Perdidos). El orden es el que pidió dirección: la franja de
 * KPIs, sin atención, campañas, embudo, y los motivos de pérdida hasta abajo.
 *
 * La prop surface se hereda del panel de VAEO a propósito: `app/page.tsx`
 * alimenta las slices filtradas por fecha más los sets `all*` sin filtrar como
 * tablas de lookup para los drill-downs. Un chart nuevo se monta sin plumbing.
 *
 * Keep the filtered / `all*` pairing when you add drill-downs: charts read the
 * date-filtered arrays, joins resolve against the unfiltered ones (a record can
 * be created outside the window that puts its counterpart on screen).
 */
export interface CellariumDashboardProps {
  opportunities: Opportunity[]
  /** Unfiltered opportunities — lookup table for drill-down joins. */
  allOpportunities?: Opportunity[]
  contacts: Contact[]
  /** Unfiltered contacts — lookup table for drill-down joins. */
  allContacts?: Contact[]
  pautas?: Pauta[]
  /** Unfiltered pautas — needed for per-contact history ranking. */
  allPautas?: Pauta[]
  pipelines?: Pipeline[]
  tasks?: Task[]
  /** Tareas SIN filtrar por fecha. Hoy ningún chart las lee; app/page.tsx las sigue pasando. */
  allTasks?: Task[]
  /**
   * Oportunidades crudas: sin filtros de panel. Solo para distinguir al contacto
   * que NO tiene ninguna oportunidad del que sí tiene pero quedó fuera de un
   * filtro. No la uses para agregar nada.
   */
  unfilteredOpportunities?: Opportunity[]
  /** Contacto → ISO del último mensaje saliente. Ausente = sin dato = cubeta más profunda. */
  conversationActivity?: Map<string, string | null>
  /** El mapa vacío NO significa "nadie escribió": hasta "ready" no se pinta la matriz. */
  activityStatus?: ActivityStatus
  activityProgress?: ActivityProgress
  onRetryActivity?: () => void
  calls?: Call[]
  messages?: Message[]
  allMessages?: Message[]
  appointments?: Appointment[]
  allAppointments?: Appointment[]
  members?: string[]
  locationId?: string
  locationName?: string
  periodLabel?: string
  dateRange?: ResolvedDateRange | null
}

export function CellariumDashboard({
  opportunities,
  contacts,
  allContacts = [],
  allOpportunities = [],
  pipelines = [],
  tasks = [],
  unfilteredOpportunities = [],
  conversationActivity,
  activityStatus = "loading",
  activityProgress,
  onRetryActivity,
  calls = [],
  allPautas = [],
  appointments = [],
  messages = [],
  locationId,
}: CellariumDashboardProps) {
  // Todo lo que los charts por-oportunidad necesitan es idéntico, así que se
  // arma una sola vez y se esparce en cada uno.
  const shared = {
    panel: "cellarium" as const,
    opportunities,
    allOpportunities,
    contacts,
    allContacts,
    pipelines,
    tasks,
    calls,
    allPautas,
    appointments,
    messages,
    locationId,
  }

  return (
    <DashboardShell>
      <KpiStrip {...shared} unfilteredOpportunities={unfilteredOpportunities} />

      <SectionHeader title="Sin atención" />
      <StaleOpportunityMatrix
        {...shared}
        conversationActivity={conversationActivity}
        activityStatus={activityStatus}
        activityProgress={activityProgress}
        onRetryActivity={onRetryActivity}
      />

      <SectionHeader title="Campañas" />
      <CampaignBreakdownChart {...shared} />
      <CampaignMonthChart {...shared} />

      <SectionHeader title="Embudo" />
      <FunnelChart {...shared} />
      <OpportunityStatusChart {...shared} />
      <AdvisorStageTable {...shared} />
      <AssignmentFunnelChart {...shared} />

      <SectionHeader title="Perdidas" />
      <LostReasonMatrix {...shared} />
    </DashboardShell>
  )
}
