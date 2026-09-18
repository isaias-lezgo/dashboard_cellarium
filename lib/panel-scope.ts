// Single source of truth for what the panel *is*.
//
// Cellarium tiene UN negocio y DOS pipelines: "Ventas" es el embudo y "Leads
// Perdidos" es donde van las perdidas (sus etapas son los motivos). El panel
// cuenta la unión de los dos: una perdida tiene que seguir contando como lead
// del mes en que entró, y un scope de un solo pipeline la haría desaparecer.
import type { Opportunity, Pipeline } from "./types"
import { LOST_PIPELINE, VENTAS_PIPELINE } from "./cellarium-rules"

export type PanelId = "cellarium"

interface PipelineRef {
  /** Nombre como se lee en GHL; también la clave de match. */
  label: string
  /** Fallback only — used when no pipeline matches by name. */
  id: string
}

export interface PanelScope {
  label: string
  /** El embudo vivo: de aquí salen las etapas del funnel y de la tabla por asesor. */
  funnel: PipelineRef
  /** La cubeta de perdidas. */
  lost: PipelineRef
}

export const PANEL_SCOPES: Record<PanelId, PanelScope> = {
  cellarium: {
    label: "Cellarium",
    funnel: VENTAS_PIPELINE,
    lost: LOST_PIPELINE,
  },
}

function resolve(pipelines: Pipeline[] | undefined, ref: PipelineRef): string {
  const match = pipelines?.find(
    (p) => p.name.trim().toLowerCase() === ref.label.toLowerCase()
  )
  return match?.id ?? ref.id
}

/**
 * El pipeline del EMBUDO (Ventas), preferring a NAME match over the hardcoded
 * id — a pipeline that gets recreated keeps its name but not its id. Es el que
 * consumen panelStageOrder() y el funnel; el de perdidas va aparte.
 */
export function resolvePipelineId(
  pipelines: Pipeline[] | undefined,
  panel: PanelId
): string {
  return resolve(pipelines, PANEL_SCOPES[panel].funnel)
}

export function resolveLostPipelineId(
  pipelines: Pipeline[] | undefined,
  panel: PanelId
): string {
  return resolve(pipelines, PANEL_SCOPES[panel].lost)
}

/** Every opportunity that belongs to the panel: Ventas ∪ Leads Perdidos. */
export function scopeOpportunities(
  opps: Opportunity[],
  panel: PanelId,
  pipelines?: Pipeline[]
): Opportunity[] {
  const funnel = resolvePipelineId(pipelines, panel)
  const lost = resolveLostPipelineId(pipelines, panel)
  return opps.filter((o) => o.pipelineId === funnel || o.pipelineId === lost)
}
