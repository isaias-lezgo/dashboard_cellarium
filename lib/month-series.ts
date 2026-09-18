// Agregación detrás de las barras apiladas por mes: un eje X mensual y una
// serie por valor de una dimensión (hoy: la campaña), con la cola larga plegada
// en "Otros" y la cubeta vacía siempre al final.
//
// `dimensionOf` es un getter y no un nombre de campo para que la dimensión pueda
// venir de donde sea (un campo nativo, un custom field, una regla) sin duplicar
// el orden de series ni el plegado, que es lo que un segundo agregado copiaría
// y desincronizaría a la primera corrección.
import type { Opportunity } from "./types"
import { monthKeyOf, monthLabelOf, NO_DATE_KEY, NO_DATE_LABEL } from "./opportunity-breakdown"

/** Clave de la serie que agrupa la cola larga de una dimensión. */
export const OTROS_KEY = "Otros"

/** Máximo de series con nombre propio. Es el tamaño de la paleta validada. */
export const DEFAULT_MAX_NAMED = 5

export interface SeriesEntry {
  /** Valor de la dimensión, OTROS_KEY, o la etiqueta de la cubeta vacía. */
  key: string
  label: string
  kind: "named" | "otros" | "empty"
  /** Total del periodo — define el orden de apilado y de la leyenda. */
  total: number
  /** Cuántos valores se plegaron aquí. Solo en kind "otros". */
  foldedCount?: number
}

export interface MonthBucket {
  /** "2026-06" o NO_DATE_KEY. */
  key: string
  label: string
  kind: "month" | "no-date"
  total: number
  /** Valor por serie. Solo trae las series con valor; el resto no aparece. */
  values: Record<string, number>
  /** Ids por serie — de aquí sale el drill-down. */
  oppIds: Record<string, string[]>
}

export interface MonthSeriesData {
  /** Total desc; "Otros" y la cubeta vacía, en ese orden, al final. */
  series: SeriesEntry[]
  /** Meses ascendentes; el bucket sin fecha al final. */
  buckets: MonthBucket[]
  grandTotal: number
}

export interface MonthSeriesOptions {
  /** Valor de la dimensión de una oportunidad. Devuelve `emptyLabel` cuando no hay. */
  dimensionOf: (opp: Opportunity) => string
  /** Etiqueta de la cubeta vacía, p. ej. NO_CAMPAIGN_LABEL. */
  emptyLabel: string
  maxNamed?: number
  /**
   * Valores que conservan nombre propio; todo lo demás se pliega en "Otros".
   * Se calcula UNA vez sobre el set sin filtrar y se impone a la llamada
   * filtrada. Sin esto, una campaña que en el total anual vive dentro de
   * "Otros" reaparecería con nombre propio al filtrar a un mes donde sí es
   * grande — y el chart repintaría las series al mover el filtro.
   */
  namedKeys?: string[]
  /** Qué oportunidades entran al agregado. Default: todas. */
  include?: (opp: Opportunity) => boolean
  /**
   * Mes al que pertenece la oportunidad (`YYYY-MM`), o null si no trae fecha
   * legible — esas caen en NO_DATE_KEY. Default: el mes de `createdAt` leído
   * en hora LOCAL (monthKeyOf de opportunity-breakdown), el mismo que usa
   * "Oportunidades por estado", para que un lead caiga en el mismo mes en las
   * dos tarjetas.
   */
  monthOf?: (opp: Opportunity) => string | null
  /** Qué se acumula: conteo ("count", default) o valor monetario ("value"). */
  measure?: "value" | "count"
}

export function buildMonthSeries(
  opps: Opportunity[],
  opts: MonthSeriesOptions
): MonthSeriesData {
  const maxNamed = opts.maxNamed ?? DEFAULT_MAX_NAMED

  // Pase 1 — clasificar cada oportunidad y acumular los totales que definen el orden.
  type Entry = { bucketKey: string; dim: string; value: number; id: string }
  const entries: Entry[] = []
  const dimTotals = new Map<string, number>()
  const bucketKeys = new Set<string>()

  const include = opts.include ?? (() => true)
  const monthOf = opts.monthOf ?? ((o: Opportunity) => monthKeyOf(o.createdAt))
  const countOnly = opts.measure !== "value"

  for (const o of opps) {
    if (!include(o)) continue
    const bucketKey = monthOf(o) ?? NO_DATE_KEY
    const dim = opts.dimensionOf(o) || opts.emptyLabel
    const value = countOnly ? 1 : o.value ?? 0

    entries.push({ bucketKey, dim, value, id: o.id })
    bucketKeys.add(bucketKey)
    dimTotals.set(dim, (dimTotals.get(dim) ?? 0) + value)
  }

  // Orden de series: total desc, empates por nombre, cubeta vacía siempre al final.
  const named = [...dimTotals.keys()]
    .filter((k) => k !== opts.emptyLabel)
    .sort((a, b) => {
      const diff = (dimTotals.get(b) ?? 0) - (dimTotals.get(a) ?? 0)
      return diff !== 0 ? diff : a.localeCompare(b, "es")
    })

  // Con namedKeys manda la lista de afuera. Sin ella se pliega TODO lo que pase
  // de maxNamed, aunque "Otros" quede con un solo valor: la paleta tiene
  // exactamente maxNamed tonos y una sexta serie con nombre no tendría color.
  let keptNames: string[]
  let foldedNames: string[]
  if (opts.namedKeys) {
    const allowed = new Set(opts.namedKeys)
    keptNames = named.filter((k) => allowed.has(k))
    foldedNames = named.filter((k) => !allowed.has(k))
  } else if (named.length > maxNamed) {
    keptNames = named.slice(0, maxNamed)
    foldedNames = named.slice(maxNamed)
  } else {
    keptNames = named
    foldedNames = []
  }
  const foldedSet = new Set(foldedNames)
  const seriesKeyOf = (dim: string) => (foldedSet.has(dim) ? OTROS_KEY : dim)

  const series: SeriesEntry[] = keptNames.map((key) => ({
    key,
    label: key,
    kind: "named",
    total: dimTotals.get(key) ?? 0,
  }))
  if (foldedNames.length > 0) {
    series.push({
      key: OTROS_KEY,
      label: OTROS_KEY,
      kind: "otros",
      total: foldedNames.reduce((sum, k) => sum + (dimTotals.get(k) ?? 0), 0),
      foldedCount: foldedNames.length,
    })
  }
  if (dimTotals.has(opts.emptyLabel)) {
    series.push({
      key: opts.emptyLabel,
      label: opts.emptyLabel,
      kind: "empty",
      total: dimTotals.get(opts.emptyLabel) ?? 0,
    })
  }

  // Orden de buckets: meses ascendentes y "sin fecha" AL FINAL.
  const months = [...bucketKeys].filter((k) => k !== NO_DATE_KEY).sort()
  const orderedKeys = bucketKeys.has(NO_DATE_KEY) ? [...months, NO_DATE_KEY] : months
  const buckets: MonthBucket[] = orderedKeys.map((key) => ({
    key,
    label: key === NO_DATE_KEY ? NO_DATE_LABEL : monthLabelOf(key),
    kind: key === NO_DATE_KEY ? "no-date" : "month",
    total: 0,
    values: {},
    oppIds: {},
  }))
  const bucketByKey = new Map(buckets.map((b) => [b.key, b]))

  // Pase 2 — llenar celdas.
  let grandTotal = 0
  for (const e of entries) {
    const bucket = bucketByKey.get(e.bucketKey)
    if (!bucket) continue
    const key = seriesKeyOf(e.dim)
    bucket.values[key] = (bucket.values[key] ?? 0) + e.value
    ;(bucket.oppIds[key] ??= []).push(e.id)
    bucket.total += e.value
    grandTotal += e.value
  }

  return { series, buckets, grandTotal }
}
