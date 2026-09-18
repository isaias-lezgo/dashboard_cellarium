// Canonical "won" detection, shared by the Marketing and Ventas dashboards so
// every won-based metric (counts, revenue, close rate, funnel) agrees.
//
// Some sub-accounts never flip GHL's `status` to "won": they record the sale by
// moving the opportunity into a late pipeline stage such as "09. Negocio Ganado"
// ("Closed Won") while leaving `status === "open"`. Treat either signal as a win
// so the dashboards work regardless of how a location operates. Detection is
// stage-name based (no hardcoded stage IDs) to stay portable across locations.
import type { Opportunity } from "./types"

// "Negocio Ganado" / "Negocio Ganada(s)" (es), "Won" / "Closed Won" (en), y
// "Cierre" — la última etapa del embudo Ventas de Cellarium. "Cierre" tiene que
// ser la etapa ENTERA: un `\b` dejaría pasar "Pre-cierre" (el guion es frontera
// de palabra), y esa etapa hipotética no es una venta.
export const WON_STAGE_PATTERN = /ganad[oa]|\bwon\b|^\s*cierre\s*$/i

export function isWonOpp(opp: Opportunity): boolean {
  if (opp.status === "won") return true
  // An explicitly lost/abandoned opp is never a win, even if it lingers in a
  // stage whose name happens to match (e.g. moved then marked lost).
  if (opp.status === "lost" || opp.status === "abandoned") return false
  return WON_STAGE_PATTERN.test(opp.stage ?? "")
}
