// Las reglas propias del CRM de Cellarium — lo que distingue a esta cuenta de
// cualquier otra subcuenta de GHL y que ningún chart debe re-inlinear.
//
// La cuenta tiene DOS pipelines y el segundo es la cubeta de perdidas: una
// oportunidad se pierde MOVIÉNDOLA a "Leads Perdidos", cuyas etapas son los
// motivos (Equivocado, No Contestó 5to contacto, Datos Erróneos…). El `status`
// de GHL no se toca en ese movimiento —620 de 1 043 perdidas seguían en "open"
// el 2026-09-17—, así que "perdida" se decide por pipeline, nunca por status.
//
// Puro y sin React para que scripts/verify-cellarium.ts lo asevere.
import type { Opportunity } from "./types"
import { isWonOpp } from "./opportunity-status"

/** Los dos pipelines de la cuenta. El id es solo fallback: se resuelve por nombre. */
export const VENTAS_PIPELINE = { label: "Ventas", id: "ImCASVNiiPqszAbyXhmf" } as const
export const LOST_PIPELINE = { label: "Leads Perdidos", id: "QaCg8OLw1hiQPs2dhsAA" } as const

/** Cubetas centinela — hueco de captura, no categoría del negocio. */
export const NO_REASON_LABEL = "Sin motivo"
export const NO_CAMPAIGN_LABEL = "Sin campaña"

function norm(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase()
}

/** ¿Este nombre de pipeline es el de perdidas? Por nombre, sin mayúsculas. */
export function isLostPipelineName(name: string | undefined): boolean {
  return norm(name) === norm(LOST_PIPELINE.label)
}

/**
 * ¿La oportunidad vive en "Leads Perdidos"? El nombre manda (un pipeline
 * recreado conserva el nombre, no el id); el id solo rescata a una oportunidad
 * cuyo pipeline el sync no pudo resolver ("Unknown").
 */
export function isInLostPipeline(opp: Opportunity): boolean {
  if (isLostPipelineName(opp.pipelineName)) return true
  return norm(opp.pipelineName) === "unknown" && opp.pipelineId === LOST_PIPELINE.id
}

/**
 * Perdida = vive en Leads Perdidos (aunque `status` diga open) O el status es
 * lost/abandoned dentro de Ventas. Pipeline manda: un `won` extraviado dentro de
 * Leads Perdidos cuenta como perdida, una sola vez.
 */
export function isLostOpp(opp: Opportunity): boolean {
  if (isInLostPipeline(opp)) return true
  return opp.status === "lost" || opp.status === "abandoned"
}

/**
 * El embudo vivo: ni perdida ni ganada. Sobre el universo del panel (Ventas ∪
 * Leads Perdidos) equivale a "en Ventas y todavía en juego", que es lo que mide
 * "Oportunidades sin atención".
 */
export function isLiveOpp(opp: Opportunity): boolean {
  return !isLostOpp(opp) && !isWonOpp(opp)
}

/**
 * Motivo de pérdida legible. Dentro de Leads Perdidos es la ETAPA; en Ventas,
 * el `lostReason` nativo que ya resolvió el sync. Sin ninguno: la centinela.
 */
export function lostReasonOf(opp: Opportunity): string {
  if (isInLostPipeline(opp)) {
    const stage = (opp.stage ?? "").trim()
    return stage && norm(stage) !== "unknown" ? stage : NO_REASON_LABEL
  }
  const raw = (opp.lostReason ?? "").trim()
  return raw || NO_REASON_LABEL
}

/**
 * La campaña de Meta que trajo el lead: `campaignName` es el `utmCampaign` de la
 * PRIMERA atribución (ver firstAttr en lib/sync.ts). Sin UTM —correo, csv,
 * captura manual— cae en la centinela.
 */
export function campaignOf(opp: Opportunity): string {
  return (opp.campaignName ?? "").trim() || NO_CAMPAIGN_LABEL
}
