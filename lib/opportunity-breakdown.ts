// Agregación detrás de "Oportunidades por estado" (barras apiladas por mes) y
// los helpers de mes y de grafía que comparten los demás charts.
//
// Puro y sin React para que scripts/verify-breakdown.ts lo pueda aseverar: un
// número silenciosamente mal aquí es invisible en la UI, que es justo la clase
// de bug por la que existen los scripts de verificación.
import type { Opportunity } from "./types"
import { isWonOpp } from "./opportunity-status"
import { isLostOpp } from "./cellarium-rules"

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

export type StatusBucket = "ganada" | "abierta" | "perdida"

export const STATUS_BUCKETS: StatusBucket[] = ["ganada", "abierta", "perdida"]

export const STATUS_LABELS: Record<StatusBucket, string> = {
  ganada: "Ganadas",
  abierta: "Abiertas",
  perdida: "Perdidas",
}

/**
 * La cubeta de una oportunidad. "Perdida" se decide con isLostOpp() —vive en
 * "Leads Perdidos" o trae status lost/abandoned— y va PRIMERO: pipeline manda
 * sobre un `won` extraviado. "Ganada" es isWonOpp(): status won o etapa Cierre.
 *
 * `abandoned` se pliega en "perdida" a propósito — no es una venta, y una cuarta
 * serie en un apilado cuesta más legibilidad de la que aporta.
 */
export function statusBucket(opp: Opportunity): StatusBucket {
  if (isLostOpp(opp)) return "perdida"
  if (isWonOpp(opp)) return "ganada"
  return "abierta"
}

export interface StatusMonthRow {
  /** `YYYY-MM`, o NO_DATE_KEY para la fila sin fecha. */
  key: string
  label: string
  ganada: number
  abierta: number
  perdida: number
  total: number
  /** Ids por cubeta, para el drill-down. */
  ids: Record<StatusBucket, string[]>
}

export const NO_DATE_KEY = "sin-fecha"
export const NO_DATE_LABEL = "Sin fecha"

const MONTHS_ES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
]

// Los tres helpers de mes se exportan —no son detalle interno— porque otros
// charts arman su propio eje mensual y tienen que rellenar los meses vacíos
// EXACTAMENTE igual: hoy lib/assignment-funnel.ts y lost-by-dimension-chart.tsx,
// este último para que una perdida caiga en el mismo mes en que "Oportunidades
// por estado" pone ese lead. Dos copias del relleno se desincronizan a la primera
// corrección y nadie lo nota: los charts simplemente dejan de compartir el eje.
export function monthKeyOf(iso: string | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  const t = d.getTime()
  if (Number.isNaN(t)) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function monthLabelOf(key: string): string {
  const [year, month] = key.split("-")
  return `${MONTHS_ES[Number(month) - 1]} ${year}`
}

function emptyRow(key: string, label: string): StatusMonthRow {
  return {
    key,
    label,
    ganada: 0,
    abierta: 0,
    perdida: 0,
    total: 0,
    ids: { ganada: [], abierta: [], perdida: [] },
  }
}

/** Todos los `YYYY-MM` de `from` a `to` inclusive, en orden. */
export function monthsBetween(from: string, to: string): string[] {
  const [fy, fm] = from.split("-").map(Number)
  const [ty, tm] = to.split("-").map(Number)
  const out: string[] = []
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm); m++) {
    if (m > 12) { m = 1; y++ }
    if (y > ty || (y === ty && m > tm)) break
    out.push(`${y}-${String(m).padStart(2, "0")}`)
  }
  return out
}

/**
 * Una fila por mes de `createdAt`, con el conteo de cada cubeta y los ids que la
 * componen.
 *
 * Los meses intermedios sin ningún registro se rellenan en cero, para que el eje
 * no insinúe continuidad donde no la hay: sin eso, un hueco de tres meses se
 * dibuja como si fueran dos meses consecutivos.
 *
 * Las oportunidades sin `createdAt` legible caen en una fila "Sin fecha" al
 * final en vez de desaparecer.
 */
export function buildStatusByMonth(opps: Opportunity[]): StatusMonthRow[] {
  const byMonth = new Map<string, StatusMonthRow>()
  let noDate: StatusMonthRow | null = null

  for (const opp of opps) {
    const key = monthKeyOf(opp.createdAt)
    let row: StatusMonthRow
    if (key === null) {
      noDate ??= emptyRow(NO_DATE_KEY, NO_DATE_LABEL)
      row = noDate
    } else {
      row = byMonth.get(key) ?? emptyRow(key, monthLabelOf(key))
      byMonth.set(key, row)
    }
    const bucket = statusBucket(opp)
    row[bucket] += 1
    row.total += 1
    row.ids[bucket].push(opp.id)
  }

  const keys = [...byMonth.keys()].sort()
  const rows =
    keys.length === 0
      ? []
      : monthsBetween(keys[0], keys[keys.length - 1]).map(
          (k) => byMonth.get(k) ?? emptyRow(k, monthLabelOf(k))
        )

  if (noDate) rows.push(noDate)
  return rows
}

// ---------------------------------------------------------------------------
// Categorías (Origen de Lead / Canal de Contacto)
// ---------------------------------------------------------------------------

/**
 * Clave de agrupamiento: minúsculas, sin acentos, y todo lo que no sea
 * alfanumérico colapsado a un espacio. Es lo que hace que `Walk In` / `Walk-in`,
 * `Activo Seo` / `Activo SEO` y `WHATSAPP` / `WhatsApp` caigan solos en el mismo
 * grupo, sin que haya que enumerar las variantes una por una.
 */
export function categoryKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

/** La grafía más usada del grupo; empate desempatado alfabéticamente, estable. */
export function mostFrequent(spellings: Map<string, number>): string {
  let best = ""
  let bestN = -1
  for (const [spelling, n] of spellings) {
    if (n > bestN || (n === bestN && spelling.localeCompare(best, "es") < 0)) {
      best = spelling
      bestN = n
    }
  }
  return best
}
