// Agregación detrás de "Leads por campaña": una fila por campaña de Meta con
// sus oportunidades partidas por estatus. Es la pregunta de dirección —qué
// campaña trae leads que se convierten y cuál trae leads que se pierden— y por
// eso la cubeta es la MISMA de "Oportunidades por estado" (statusBucket), para
// que los totales de las dos tarjetas cuadren.
//
// Puro y sin React para que scripts/verify-campaign.ts lo asevere.
import type { Opportunity } from "./types"
import { campaignOf, isNoCampaign, NO_CAMPAIGN_ORDER } from "./cellarium-rules"
import { statusBucket, type StatusBucket } from "./opportunity-breakdown"

export interface CampaignRow {
  key: string
  label: string
  /** true en las filas "Sin campaña · …", que van al final y con la etiqueta en rojizo. */
  missing: boolean
  total: number
  ganada: number
  abierta: number
  perdida: number
  ids: Record<StatusBucket, string[]>
}

function emptyRow(label: string): CampaignRow {
  return {
    key: label,
    label,
    missing: isNoCampaign(label),
    total: 0,
    ganada: 0,
    abierta: 0,
    perdida: 0,
    ids: { ganada: [], abierta: [], perdida: [] },
  }
}

/**
 * Filas por volumen desc (empate alfabético); las cubetas "Sin campaña · …"
 * siempre al final, en su orden fijo y no por volumen.
 */
export function buildCampaignBreakdown(opps: Opportunity[]): CampaignRow[] {
  const rows = new Map<string, CampaignRow>()
  for (const o of opps) {
    const label = campaignOf(o)
    let row = rows.get(label)
    if (!row) {
      row = emptyRow(label)
      rows.set(label, row)
    }
    const bucket = statusBucket(o)
    row[bucket] += 1
    row.ids[bucket].push(o.id)
    row.total += 1
  }
  return [...rows.values()].sort((a, b) => {
    if (a.missing !== b.missing) return a.missing ? 1 : -1
    if (a.missing) return NO_CAMPAIGN_ORDER.indexOf(a.label) - NO_CAMPAIGN_ORDER.indexOf(b.label)
    return b.total - a.total || a.label.localeCompare(b.label, "es")
  })
}
