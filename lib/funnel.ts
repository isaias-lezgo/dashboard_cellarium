// Los pasos del "Embudo de ventas": una barra por etapa del pipeline Ventas, y
// abajo Ganadas y Perdidas.
//
// Es una FOTO del hoy sobre los leads del periodo: GHL no guarda el historial de
// etapas, así que se cuenta cuántos ESTÁN en cada etapa, no cuántos pasaron por
// ella. Una perdida ya no tiene etapa de Ventas (vive en Leads Perdidos), y una
// ganada tampoco (Cierre, o el status won): por eso van en pasos propios y la
// etapa "Cierre" no es un paso — sus oportunidades son las ganadas.
//
// Puro y sin React para que scripts/verify-funnel.ts lo asevere.
import type { Opportunity } from "./types"
import { statusBucket } from "./opportunity-breakdown"
import { WON_STAGE_PATTERN } from "./opportunity-status"

export type FunnelStepKind = "stage" | "won" | "lost"

export interface FunnelStep {
  key: string
  label: string
  kind: FunnelStepKind
  count: number
  /** Porcentaje sobre el total de leads del periodo (perdidas incluidas), 0–100. */
  pct: number
  oppIds: string[]
}

export interface FunnelData {
  steps: FunnelStep[]
  /** Todas las oportunidades del periodo — el denominador de cada `pct`. */
  total: number
}

export const WON_STEP_LABEL = "Ganadas"
export const LOST_STEP_LABEL = "Perdidas"

const stageKey = (s: string) => s.trim().toLowerCase()

export function buildFunnel(opps: Opportunity[], stageOrder: string[]): FunnelData {
  // Etapas del embudo en orden de pipeline, sin la de cierre (es "Ganadas").
  const stages = stageOrder.filter((s) => !WON_STAGE_PATTERN.test(s))
  const stageByKey = new Map(stages.map((s) => [stageKey(s), s]))
  const won: string[] = []
  const lost: string[] = []
  const byStage = new Map<string, string[]>(stages.map((s) => [s, []]))

  for (const o of opps) {
    const bucket = statusBucket(o)
    if (bucket === "ganada") {
      won.push(o.id)
      continue
    }
    if (bucket === "perdida") {
      lost.push(o.id)
      continue
    }
    const raw = (o.stage ?? "").trim()
    let label = stageByKey.get(stageKey(raw))
    if (!label) {
      // Una etapa que ya no está en el embudo pero sí en los datos: columna
      // extra al final, no un registro perdido.
      label = raw || "Otra etapa"
      stageByKey.set(stageKey(label), label)
      stages.push(label)
      byStage.set(label, [])
    }
    byStage.get(label)!.push(o.id)
  }

  const total = opps.length
  const pctOf = (n: number) => (total === 0 ? 0 : (n / total) * 100)
  const step = (key: string, label: string, kind: FunnelStepKind, ids: string[]): FunnelStep => ({
    key,
    label,
    kind,
    count: ids.length,
    pct: pctOf(ids.length),
    oppIds: ids,
  })

  const steps: FunnelStep[] = stages.map((s) => step(`stage:${stageKey(s)}`, s, "stage", byStage.get(s)!))
  steps.push(step("won", WON_STEP_LABEL, "won", won))
  steps.push(step("lost", LOST_STEP_LABEL, "lost", lost))
  return { steps, total }
}
