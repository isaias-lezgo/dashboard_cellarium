// El cruce detrás de la tabla "Motivos de pérdida": motivo × campaña.
//
// Puro y sin React para que scripts/verify-lost-matrix.ts lo pueda aseverar: un
// cruce mal armado da una respuesta silenciosamente equivocada —una celda que
// suma en la columna que no era se ve idéntica a una correcta.
import type { Opportunity } from "./types"
import { campaignOf, isNoCampaign, lostReasonOf, NO_CAMPAIGN_ORDER, NO_REASON_LABEL } from "./cellarium-rules"
import { categoryKey, mostFrequent, statusBucket } from "./opportunity-breakdown"

/** Fila sin motivo capturado. Siempre va al final, aunque sea grande. */
export { NO_REASON_LABEL }

export interface LostMatrixColumn {
  /** Etiqueta de la categoría; es también la clave de React. */
  label: string
  total: number
  /** true para la columna "Sin campaña". */
  missing: boolean
}

export interface LostMatrixCell {
  count: number
  oppIds: string[]
}

export interface LostMatrixRow {
  label: string
  /** Una celda por columna, en el mismo orden que `columns`. */
  cells: LostMatrixCell[]
  /** Oportunidades DISTINTAS con este motivo — no la suma de las celdas. */
  total: number
  /** Porcentaje sobre el total de perdidas, 0–100. */
  pct: number
  oppIds: string[]
  /** true para la fila "Sin motivo". */
  missing: boolean
}

export interface LostReasonMatrix {
  columns: LostMatrixColumn[]
  rows: LostMatrixRow[]
  /** Fila de totales al pie, alineada con `columns`. */
  totals: LostMatrixCell[]
  /** Oportunidades perdidas distintas. */
  grandTotal: number
  /** El conteo de la celda más grande — para el sombreado de calor. */
  maxCell: number
}

const EMPTY: LostReasonMatrix = {
  columns: [],
  rows: [],
  totals: [],
  grandTotal: 0,
  maxCell: 0,
}

/**
 * Matriz motivo × campaña sobre las oportunidades PERDIDAS de `opps`.
 *
 * "Perdida" es `statusBucket()` — vive en Leads Perdidos o trae lost/abandoned —
 * la misma definición que la barra roja del gráfico de estado, para que los
 * totales de las dos tarjetas cuadren. El motivo es `lostReasonOf()`: la etapa
 * dentro de Leads Perdidos, el `lostReason` nativo en Ventas.
 *
 * La campaña es un solo valor por oportunidad, así que cada una cae en UNA
 * columna y la suma horizontal de una fila es su total.
 */
export function buildLostReasonMatrix(opps: Opportunity[]): LostReasonMatrix {
  const lost = opps.filter((o) => statusBucket(o) === "perdida")
  if (lost.length === 0) return EMPTY

  // Columnas: campañas por volumen desc, las cubetas "Sin campaña · …" al final
  // en su orden fijo.
  const colCounts = new Map<string, number>()
  const colIdsByLabel = new Map<string, string[]>()
  for (const o of lost) {
    const c = campaignOf(o)
    colCounts.set(c, (colCounts.get(c) ?? 0) + 1)
    const ids = colIdsByLabel.get(c) ?? []
    ids.push(o.id)
    colIdsByLabel.set(c, ids)
  }
  const colLabels = [...colCounts.keys()]
    .filter((k) => !isNoCampaign(k))
    .sort((a, b) => colCounts.get(b)! - colCounts.get(a)! || a.localeCompare(b, "es"))
  colLabels.push(...NO_CAMPAIGN_ORDER.filter((k) => colCounts.has(k)))
  const columns: LostMatrixColumn[] = colLabels.map((label) => ({
    label,
    total: colCounts.get(label)!,
    missing: isNoCampaign(label),
  }))
  const colIndex = new Map(colLabels.map((l, i) => [l, i]))
  const colByOpp = new Map(lost.map((o) => [o.id, colIndex.get(campaignOf(o))!]))

  // Filas: se agrupan por clave normalizada para que "No Contesta" y "No
  // contesta" no se partan en dos, y se muestra la grafía más frecuente.
  interface Group {
    spellings: Map<string, number>
    oppIds: string[]
  }
  const groups = new Map<string, Group>()
  const noReason: string[] = []
  for (const o of lost) {
    const reason = lostReasonOf(o)
    const key = reason === NO_REASON_LABEL ? "" : categoryKey(reason)
    if (key === "") {
      noReason.push(o.id)
      continue
    }
    const g: Group = groups.get(key) ?? { spellings: new Map(), oppIds: [] }
    g.spellings.set(reason, (g.spellings.get(reason) ?? 0) + 1)
    g.oppIds.push(o.id)
    groups.set(key, g)
  }

  const pctOf = (n: number) => (n / lost.length) * 100
  const buildRow = (label: string, oppIds: string[], missing: boolean): LostMatrixRow => {
    const cells: LostMatrixCell[] = columns.map(() => ({ count: 0, oppIds: [] }))
    for (const id of oppIds) {
      const i = colByOpp.get(id)!
      cells[i].count += 1
      cells[i].oppIds.push(id)
    }
    return { label, cells, total: oppIds.length, pct: pctOf(oppIds.length), oppIds, missing }
  }

  const rows: LostMatrixRow[] = [...groups.values()]
    .map((g) => buildRow(mostFrequent(g.spellings), g.oppIds, false))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"))
  if (noReason.length > 0) rows.push(buildRow(NO_REASON_LABEL, noReason, true))

  const totals: LostMatrixCell[] = columns.map((c) => ({
    count: c.total,
    oppIds: colIdsByLabel.get(c.label) ?? [],
  }))

  let maxCell = 0
  for (const row of rows) for (const cell of row.cells) if (cell.count > maxCell) maxCell = cell.count

  return { columns, rows, totals, grandTotal: lost.length, maxCell }
}
