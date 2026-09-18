// Los dos filtros globales de la barra: asesor y campaña.
//
// Cambian de qué oportunidades habla el panel entero, no cómo dibuja un gráfico.
// Por eso se aplican en app/page.tsx sobre el set de oportunidades ANTES del
// corte por fecha: así las slices filtradas y los sets `all*` que resuelven los
// drill-downs ven el mismo universo, y un drawer nunca puede sacar a la luz un
// registro que los gráficos excluyeron.
//
// Puro y sin React para que scripts/verify-panel-filters.ts pueda afirmarlo.
import type { Opportunity } from "./types"
import { campaignOf, NO_CAMPAIGN_LABEL } from "./cellarium-rules"

/** Estado de los dos menús. Arreglo vacío = ese menú no filtra nada. */
export interface PanelFilters {
  /** Claves de asesor seleccionadas (las de ADVISORS). */
  asesores: string[]
  /** Campañas seleccionadas tal cual las devuelve campaignOf(); NO_CAMPAIGN_LABEL alcanza a los sin dato. */
  campanas: string[]
}

export const EMPTY_PANEL_FILTERS: PanelFilters = {
  asesores: [],
  campanas: [],
}

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
  /** true solo en la cubeta "Sin campaña", que va al final y en gris. */
  muted?: boolean
}

/**
 * Las campañas presentes en el set, por volumen descendente, con "Sin campaña"
 * siempre al final — no es una campaña, pero deja esos registros alcanzables
 * desde la barra. Se calcula sobre el set SIN los filtros de panel puestos.
 */
export function campaignOptions(opps: Opportunity[]): CampaignOption[] {
  const counts = new Map<string, number>()
  for (const o of opps) {
    const c = campaignOf(o)
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  const named = [...counts.entries()]
    .filter(([k]) => k !== NO_CAMPAIGN_LABEL)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .map(([value, count]) => ({ value, label: value, count }))
  const missing = counts.get(NO_CAMPAIGN_LABEL) ?? 0
  return missing > 0
    ? [...named, { value: NO_CAMPAIGN_LABEL, label: NO_CAMPAIGN_LABEL, count: missing, muted: true }]
    : named
}

/**
 * Dentro de un menú los valores son OR; entre los dos menús es AND. Un menú sin
 * selección no filtra: es el estado inicial. Deliberadamente NO se usa "todas
 * seleccionadas" como estado neutro — con esa convención, una campaña nueva en
 * el CRM quedaría fuera de un filtro que el usuario cree que no tiene puesto.
 */
export function applyPanelFilters(
  opps: Opportunity[],
  filters: PanelFilters
): Opportunity[] {
  const byAsesor = filters.asesores.length > 0
  const byCampana = filters.campanas.length > 0
  // Misma referencia cuando no hay nada que filtrar: una copia nueva
  // invalidaría los memos aguas abajo.
  if (!byAsesor && !byCampana) return opps

  const asesores = new Set(filters.asesores)
  const campanas = new Set(filters.campanas)

  return opps.filter((o) => {
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
  return filters.asesores.length + filters.campanas.length
}
