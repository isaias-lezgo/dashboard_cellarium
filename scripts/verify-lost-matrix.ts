// Verification for lib/lost-reason-matrix.ts — motivo de pérdida × campaña.
// Correr: pnpm verify:lost-matrix
//
// Un cruce mal armado da una respuesta silenciosamente equivocada: una celda
// que suma en la columna que no era se ve idéntica a una correcta.
// Envuelto en main() en vez de top-level await: este paquete es CJS.
import assert from "node:assert/strict";
import type { Opportunity } from "../lib/types";
import { LOST_PIPELINE, NO_CAMPAIGN_LABEL, NO_REASON_LABEL, VENTAS_PIPELINE } from "../lib/cellarium-rules";
import { buildLostReasonMatrix } from "../lib/lost-reason-matrix";

let seq = 0;
function opp(o: {
  lost?: boolean;
  status?: Opportunity["status"];
  stage?: string;
  lostReason?: string;
  campaignName?: string;
}): Opportunity {
  return {
    id: `o${++seq}`,
    name: `Opp ${seq}`,
    pipelineId: o.lost ? LOST_PIPELINE.id : VENTAS_PIPELINE.id,
    pipelineStageId: "s",
    status: o.status ?? "open",
    createdAt: "2026-06-15T12:00:00.000Z",
    contactId: `c${seq}`,
    value: 0,
    stage: o.stage ?? (o.lost ? "Equivocado" : "Lead Generado"),
    pipelineName: o.lost ? LOST_PIPELINE.label : VENTAS_PIPELINE.label,
    lostReason: o.lostReason,
    campaignName: o.campaignName,
  };
}
const cellOf = (m: ReturnType<typeof buildLostReasonMatrix>, row: string, col: string) => {
  const r = m.rows.find((x) => x.label === row);
  const c = m.columns.findIndex((x) => x.label === col);
  assert.ok(r && c >= 0, `celda ${row} × ${col}`);
  return r!.cells[c];
};

function main() {
  // 1. Solo perdidas entran; abiertas y ganadas quedan fuera.
  {
    const m = buildLostReasonMatrix([
      opp({ lost: true, stage: "Equivocado", campaignName: "A" }),
      opp({ campaignName: "A" }),
      opp({ status: "won", campaignName: "A" }),
    ]);
    assert.equal(m.grandTotal, 1);
    assert.deepEqual(m.rows.map((r) => r.label), ["Equivocado"]);
  }

  // 2. Fila = etapa de Leads Perdidos o lostReason nativo; columna = campaña.
  {
    const m = buildLostReasonMatrix([
      opp({ lost: true, stage: "Equivocado", campaignName: "A" }),
      opp({ lost: true, stage: "Equivocado", campaignName: "A" }),
      opp({ lost: true, stage: "No Contestó 5to contacto", campaignName: "B" }),
      opp({ status: "lost", lostReason: "Sin presupuesto", campaignName: "A" }),
      opp({ status: "abandoned", campaignName: "B" }),
      opp({ lost: true, stage: "Equivocado" }),
    ]);
    assert.equal(m.grandTotal, 6);
    // Columnas por volumen desc, "Sin campaña" al final y marcada.
    assert.deepEqual(m.columns.map((c) => c.label), ["A", "B", NO_CAMPAIGN_LABEL]);
    assert.deepEqual(m.columns.map((c) => c.missing), [false, false, true]);
    assert.deepEqual(m.columns.map((c) => c.total), [3, 2, 1]);
    // Filas por volumen desc, "Sin motivo" al final y marcada.
    assert.deepEqual(m.rows.map((r) => r.label), ["Equivocado", "No Contestó 5to contacto", "Sin presupuesto", NO_REASON_LABEL]);
    assert.equal(m.rows.at(-1)!.missing, true);
    assert.equal(cellOf(m, "Equivocado", "A").count, 2);
    assert.equal(cellOf(m, "Equivocado", NO_CAMPAIGN_LABEL).count, 1);
    assert.equal(cellOf(m, NO_REASON_LABEL, "B").count, 1);
    assert.equal(cellOf(m, "Sin presupuesto", "B").count, 0);
    // Una oportunidad cae en UNA columna: la suma horizontal es el total de la fila.
    for (const r of m.rows) assert.equal(r.cells.reduce((s, c) => s + c.count, 0), r.total);
    assert.equal(m.rows[0].pct, 50);
    assert.deepEqual(m.totals.map((t) => t.count), [3, 2, 1]);
    assert.equal(m.maxCell, 2);
  }

  // 3. Grafías del motivo se unen bajo la más frecuente.
  {
    const m = buildLostReasonMatrix([
      opp({ status: "lost", lostReason: "No contesta", campaignName: "A" }),
      opp({ status: "lost", lostReason: "No contesta", campaignName: "A" }),
      opp({ status: "lost", lostReason: "NO CONTESTA", campaignName: "A" }),
    ]);
    assert.deepEqual(m.rows.map((r) => r.label), ["No contesta"]);
    assert.equal(m.rows[0].total, 3);
  }

  // 4. Vacío.
  {
    const m = buildLostReasonMatrix([opp({})]);
    assert.deepEqual(m.rows, []);
    assert.equal(m.grandTotal, 0);
  }

  console.log("✅ lib/lost-reason-matrix.ts — all assertions passed");
}

main();
