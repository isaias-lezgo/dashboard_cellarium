// Verification for lib/campaign-breakdown.ts — campaña × estatus.
// Correr: pnpm verify:campaign
// Envuelto en main(): este paquete es CJS.
import assert from "node:assert/strict";
import type { Opportunity } from "../lib/types";
import { LOST_PIPELINE, NO_CAMPAIGN_BUCKETS, VENTAS_PIPELINE } from "../lib/cellarium-rules";
import { buildCampaignBreakdown } from "../lib/campaign-breakdown";

let seq = 0;
function opp(o: { lost?: boolean; status?: Opportunity["status"]; campaignName?: string }): Opportunity {
  return {
    id: `o${++seq}`,
    name: `Opp ${seq}`,
    pipelineId: o.lost ? LOST_PIPELINE.id : VENTAS_PIPELINE.id,
    pipelineStageId: "s",
    status: o.status ?? "open",
    createdAt: "2026-06-15T12:00:00.000Z",
    contactId: `c${seq}`,
    value: 0,
    stage: o.lost ? "Equivocado" : "Lead Generado",
    pipelineName: o.lost ? LOST_PIPELINE.label : VENTAS_PIPELINE.label,
    campaignName: o.campaignName,
  };
}

function main() {
  // 1. Una fila por campaña, por volumen desc, con las tres cubetas.
  {
    const rows = buildCampaignBreakdown([
      opp({ campaignName: "A" }),
      opp({ campaignName: "A", status: "won" }),
      opp({ campaignName: "A", lost: true }),
      opp({ campaignName: "B", lost: true }),
      opp({}),
    ]);
    assert.deepEqual(rows.map((r) => r.label), ["A", "B", NO_CAMPAIGN_BUCKETS.other]);
    assert.deepEqual(rows.map((r) => r.missing), [false, false, true]);
    assert.deepEqual(rows.map((r) => r.total), [3, 1, 1]);
    assert.equal(rows[0].ganada, 1);
    assert.equal(rows[0].abierta, 1);
    assert.equal(rows[0].perdida, 1);
    assert.deepEqual(rows[0].ids.ganada.length, 1);
    assert.equal(rows[1].perdida, 1);
  }

  // 2. Empate de volumen: alfabético; las cubetas "Sin campaña · …" siguen al
  //    final aunque pesen más, y entre ellas manda el orden fijo (pagado antes
  //    que otro aunque tenga menos).
  {
    const rows = buildCampaignBreakdown([
      opp({ campaignName: "Z" }),
      opp({ campaignName: "A" }),
      opp({}),
      opp({}),
      { ...opp({}), sessionSource: "Paid Social" },
    ]);
    assert.deepEqual(rows.map((r) => r.label), ["A", "Z", NO_CAMPAIGN_BUCKETS.paid, NO_CAMPAIGN_BUCKETS.other]);
  }

  // 3. Vacío.
  assert.deepEqual(buildCampaignBreakdown([]), []);

  console.log("✅ lib/campaign-breakdown.ts — all assertions passed");
}

main();
