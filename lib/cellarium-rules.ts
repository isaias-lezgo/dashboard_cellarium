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

/** La zona horaria del cliente (San Luis Potosí). Las rutas de IA usan este mismo default. */
export const PANEL_TIME_ZONE = "America/Mexico_City"

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
 * Las cuatro cubetas de "sin campaña", por CÓMO llegó el lead. Medido
 * 2026-09-18: de 734 sin `utm_campaign`, 416 son Meta orgánico / mensaje
 * directo, 165 son pauta PAGADA que perdió el parámetro (desde ago-2026 el
 * 100 % de los leads llega así — el pendiente para la agencia está en Meta, no
 * en el CRM), 98 importación o captura manual y 49 otro origen. Un solo gris
 * de 734 escondía justo esa ruptura. Desde que campaignOf() cae al anuncio /
 * al form, la cubeta "pagado" queda en 2: los 163 restantes se leen por
 * anuncio o formulario, con prefijo.
 *
 * Todas empiezan con NO_CAMPAIGN_LABEL: así isMissingLabel() las tiñe y los
 * charts las reconocen con isNoCampaign(). El orden del objeto es el de
 * presentación.
 */
export const NO_CAMPAIGN_BUCKETS = {
  paid: `${NO_CAMPAIGN_LABEL} · Meta pagado`,
  organic: `${NO_CAMPAIGN_LABEL} · Meta orgánico / mensaje directo`,
  imported: `${NO_CAMPAIGN_LABEL} · importación / captura manual`,
  other: `${NO_CAMPAIGN_LABEL} · otro origen`,
} as const

/** Las cuatro etiquetas, en orden de presentación. */
export const NO_CAMPAIGN_ORDER: readonly string[] = Object.values(NO_CAMPAIGN_BUCKETS)

/** ¿Esta etiqueta de campaña es una de las cubetas centinela? */
export function isNoCampaign(label: string): boolean {
  return label.startsWith(NO_CAMPAIGN_LABEL)
}

const IMPORT_MEDIA = new Set(["csv_import", "manual", "import", "api"])

/**
 * Prefijos de las etiquetas que NO son campañas sino otro nivel de la jerarquía
 * de Meta (campaña → conjunto → anuncio → formulario). Van con prefijo para que
 * dirección no compare un anuncio contra una campaña como si fueran lo mismo.
 */
export const AD_LABEL_PREFIX = "Anuncio · "
export const FORM_LABEL_PREFIX = "Form · "

/**
 * La campaña de Meta que trajo el lead: `campaignName` es el `utmCampaign` de la
 * PRIMERA atribución (ver firstAttr en lib/sync.ts; medido 2026-09-18: solo 3
 * de 1 865 la traen en una atribución posterior y no en la primera), con caída
 * al `attributionSource.campaign` del contacto (+6).
 *
 * Sin campaña, la pauta pagada cae a lo que Meta SÍ le pasó a GHL: el `adName`
 * del anuncio (click-to-WhatsApp, vía ctwaClid) o el nombre del instant form
 * (resuelto por el sync a partir del `mediumId`). Medido 2026-09-18 sobre los
 * 166 "Meta pagado sin campaña": 87 traen anuncio, 96 el form, 1 nada. Es un
 * proxy —el headline cambia con cada creativo y se reusa entre campañas—; el
 * arreglo de fondo sigue siendo `utm_campaign` en Meta. Sin nada de eso, una de
 * las cuatro cubetas de NO_CAMPAIGN_BUCKETS según `sessionSource` y medio.
 */
export function campaignOf(opp: Opportunity): string {
  const name = (opp.campaignName ?? "").trim()
  if (name) return name
  const ad = (opp.adName ?? "").trim()
  if (ad) return `${AD_LABEL_PREFIX}${ad}`
  const form = (opp.leadFormName ?? "").trim()
  if (form) return `${FORM_LABEL_PREFIX}${form}`
  const session = norm(opp.sessionSource)
  const medium = norm(opp.attributionMedium)
  if (session === "paid social") return NO_CAMPAIGN_BUCKETS.paid
  if (session === "social media") return NO_CAMPAIGN_BUCKETS.organic
  if (session === "crm ui" || IMPORT_MEDIA.has(medium)) return NO_CAMPAIGN_BUCKETS.imported
  return NO_CAMPAIGN_BUCKETS.other
}
