// Los tres filtros globales de la barra: pipeline, asesor y campaña.
//
// Cambian de qué oportunidades habla el panel entero, no cómo dibuja un gráfico.
// Por eso se aplican en app/page.tsx sobre el set de oportunidades ANTES del
// corte por fecha: así las slices filtradas y los sets `all*` que resuelven los
// drill-downs ven el mismo universo, y un drawer nunca puede sacar a la luz un
// registro que los gráficos excluyeron.
//
// Puro y sin React para que scripts/verify-panel-filters.ts pueda afirmarlo.
import type { Opportunity } from "./types"
import {
  campaignOf,
  isInLostPipeline,
  isNoCampaign,
  NO_CAMPAIGN_ORDER,
  VENTAS_PIPELINE,
  LOST_PIPELINE,
} from "./cellarium-rules"

/** Estado de los tres menús. Arreglo vacío = ese menú no filtra nada. */
export interface PanelFilters {
  /** Pipelines seleccionados (las claves de PIPELINES). */
  pipelines: PipelineKey[]
  /** Claves de asesor seleccionadas (las de ADVISORS). */
  asesores: string[]
  /** Campañas seleccionadas tal cual las devuelve campaignOf(); las cubetas "Sin campaña · …" son seleccionables. */
  campanas: string[]
}

export const EMPTY_PANEL_FILTERS: PanelFilters = {
  pipelines: [],
  asesores: [],
  campanas: [],
}

/**
 * Los dos pipelines de la cuenta, en el orden del menú: Ventas primero porque
 * es el embudo; Leads Perdidos es la cubeta. Ojo con lo que significa marcar
 * solo Ventas: como el filtro recorta el universo ANTES de todo, "Perdidas"
 * baja a las ~40 marcadas `lost` dentro de Ventas y el % del embudo deja de
 * llevar las perdidas en el denominador. Es un filtro de alcance, no de dibujo.
 */
export const PIPELINES = [
  { key: "ventas", label: VENTAS_PIPELINE.label },
  { key: "perdidos", label: LOST_PIPELINE.label },
] as const

export type PipelineKey = (typeof PIPELINES)[number]["key"]

/**
 * Los cinco usuarios que llevan cartera (medido 2026-09-17: Carla 982, Roberto
 * 336, Francisco 232, Verónica 135, María 29). Los otros cuatro de la subcuenta
 * son dirección y no tienen oportunidades; ofrecerlos sería ruido.
 *
 * `key` es el primer nombre normalizado, que es también con lo que se hace el
 * match: si alguien corrige un apellido en GHL el filtro no debe dejar de
 * funcionar en silencio. Los cinco primeros nombres son distintos entre sí.
 */
export const ADVISORS = [
  { key: "carla", label: "Carla Moreno" },
  { key: "roberto", label: "Roberto Mendoza" },
  { key: "francisco", label: "Francisco Maza" },
  { key: "veronica", label: "Verónica González" },
  { key: "maria", label: "María Berrueta" },
] as const

export type AdvisorKey = (typeof ADVISORS)[number]["key"]

/** Sin acentos y en minúsculas, para comparar nombres capturados a mano. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
}

/**
 * En cuál de los dos pipelines vive la oportunidad, o undefined si en ninguno.
 * Misma regla que `isInLostPipeline`: el nombre manda, el id solo rescata a la
 * que el sync dejó en "Unknown" — un pipeline recreado conserva el nombre.
 */
export function pipelineKeyOf(opp: Opportunity): PipelineKey | undefined {
  if (isInLostPipeline(opp)) return "perdidos"
  const name = normalize(opp.pipelineName ?? "")
  if (name === normalize(VENTAS_PIPELINE.label)) return "ventas"
  if (name === "unknown" && opp.pipelineId === VENTAS_PIPELINE.id) return "ventas"
  return undefined
}

export interface PipelineOption {
  value: PipelineKey
  label: string
  count: number
}

/** Las dos opciones siempre, en orden fijo, con su conteo sobre el set SIN filtrar. */
export function pipelineOptions(opps: Opportunity[]): PipelineOption[] {
  const counts = new Map<PipelineKey, number>()
  for (const o of opps) {
    const key = pipelineKeyOf(o)
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return PIPELINES.map((p) => ({ value: p.key, label: p.label, count: counts.get(p.key) ?? 0 }))
}

/** Clave del asesor asignado, o undefined si no es ninguno de los cinco. */
export function advisorKeyOf(opp: Opportunity): AdvisorKey | undefined {
  const first = normalize(opp.assignedTo ?? "").split(/\s+/)[0]
  if (!first) return undefined
  return ADVISORS.find((a) => a.key === first)?.key
}

export interface CampaignOption {
  value: string
  label: string
  count: number
  /** true en las cubetas "Sin campaña · …", que van al final y en gris. */
  muted?: boolean
}

/**
 * Las campañas presentes en el set, por volumen descendente, con las cubetas
 * "Sin campaña · …" siempre al final y en su orden fijo — no son campañas, pero
 * dejan esos registros alcanzables desde la barra. Se calcula sobre el set SIN
 * los filtros de panel puestos.
 */
export function campaignOptions(opps: Opportunity[]): CampaignOption[] {
  const counts = new Map<string, number>()
  for (const o of opps) {
    const c = campaignOf(o)
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  const named = [...counts.entries()]
    .filter(([k]) => !isNoCampaign(k))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .map(([value, count]) => ({ value, label: value, count }))
  const missing = NO_CAMPAIGN_ORDER.filter((k) => counts.has(k)).map((value) => ({
    value,
    label: value,
    count: counts.get(value)!,
    muted: true,
  }))
  return [...named, ...missing]
}

/**
 * Dentro de un menú los valores son OR; entre los tres menús es AND. Un menú sin
 * selección no filtra: es el estado inicial. Deliberadamente NO se usa "todas
 * seleccionadas" como estado neutro — con esa convención, una campaña nueva en
 * el CRM quedaría fuera de un filtro que el usuario cree que no tiene puesto.
 */
export function applyPanelFilters(
  opps: Opportunity[],
  filters: PanelFilters
): Opportunity[] {
  const byPipeline = filters.pipelines.length > 0
  const byAsesor = filters.asesores.length > 0
  const byCampana = filters.campanas.length > 0
  // Misma referencia cuando no hay nada que filtrar: una copia nueva
  // invalidaría los memos aguas abajo.
  if (!byPipeline && !byAsesor && !byCampana) return opps

  const pipelines = new Set<string>(filters.pipelines)
  const asesores = new Set(filters.asesores)
  const campanas = new Set(filters.campanas)

  return opps.filter((o) => {
    if (byPipeline) {
      const key = pipelineKeyOf(o)
      if (!key || !pipelines.has(key)) return false
    }
    if (byAsesor) {
      const key = advisorKeyOf(o)
      if (!key || !asesores.has(key)) return false
    }
    if (byCampana && !campanas.has(campaignOf(o))) return false
    return true
  })
}

/** Cuántas opciones hay marcadas en total — alimenta el aviso de "filtros activos". */
export function activeFilterCount(filters: PanelFilters): number {
  return filters.pipelines.length + filters.asesores.length + filters.campanas.length
}
