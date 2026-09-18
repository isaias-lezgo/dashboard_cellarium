// Verification for lib/cellarium-rules.ts — las reglas propias del CRM de
// Cellarium. Correr: pnpm verify:cellarium
//
// La cuenta registra una pérdida MOVIENDO la oportunidad al pipeline "Leads
// Perdidos" sin tocar su `status` (620 de 1 043 seguían en "open", medido el
// 2026-09-17). Un panel que lea `status` reporta 620 abiertas de más y nadie lo
// nota: los números son verosímiles. Por eso estas reglas se aseveran aparte.
//
// Envuelto en main() en vez de top-level await: este paquete es CJS.
import assert from "node:assert/strict";
import type { Opportunity } from "../lib/types";
import {
  campaignOf,
  isInLostPipeline,
  isLiveOpp,
  isLostOpp,
  LOST_PIPELINE,
  lostReasonOf,
  NO_CAMPAIGN_LABEL,
  NO_REASON_LABEL,
  VENTAS_PIPELINE,
} from "../lib/cellarium-rules";
import { statusBucket } from "../lib/opportunity-breakdown";
import { isWonOpp } from "../lib/opportunity-status";

let seq = 0;

function opp(o: {
  pipeline?: "ventas" | "perdidos";
  pipelineName?: string;
  status?: Opportunity["status"];
  stage?: string;
  lostReason?: string;
  campaignName?: string;
}): Opportunity {
  const inLost = o.pipeline === "perdidos";
  return {
    id: `o${++seq}`,
    name: `Opp ${seq}`,
    pipelineId: inLost ? LOST_PIPELINE.id : VENTAS_PIPELINE.id,
    pipelineStageId: "stage-1",
    status: o.status ?? "open",
    createdAt: "2026-06-15T12:00:00.000Z",
    contactId: `c${seq}`,
    value: 0,
    stage: o.stage ?? (inLost ? "Equivocado" : "Lead Generado"),
    pipelineName: o.pipelineName ?? (inLost ? LOST_PIPELINE.label : VENTAS_PIPELINE.label),
    lostReason: o.lostReason,
    campaignName: o.campaignName,
  };
}

function main() {
  // 1. Perdida = vive en Leads Perdidos, aunque el status diga open.
  {
    const o = opp({ pipeline: "perdidos", status: "open" });
    assert.ok(isInLostPipeline(o));
    assert.ok(isLostOpp(o));
    assert.equal(statusBucket(o), "perdida");
    assert.ok(!isLiveOpp(o));
  }

  // 1b. El nombre del pipeline manda sobre el id, sin distinguir mayúsculas.
  {
    const o = opp({ pipeline: "ventas", pipelineName: "leads perdidos" });
    assert.ok(isInLostPipeline(o), "un pipeline recreado conserva el nombre, no el id");
    const byId = opp({ pipeline: "perdidos", pipelineName: "Unknown" });
    assert.ok(isInLostPipeline(byId), "sin nombre resuelto cae al id");
  }

  // 2. Perdida en Ventas por status.
  {
    assert.equal(statusBucket(opp({ status: "lost" })), "perdida");
    assert.equal(statusBucket(opp({ status: "abandoned" })), "perdida");
    assert.ok(!isLiveOpp(opp({ status: "lost" })));
  }

  // 3. Ganada: status won, o la etapa Cierre con status open.
  {
    assert.equal(statusBucket(opp({ status: "won", stage: "Contactado" })), "ganada");
    assert.equal(statusBucket(opp({ status: "open", stage: "Cierre" })), "ganada");
    assert.ok(isWonOpp(opp({ status: "open", stage: "cierre" })), "sin distinguir mayúsculas");
    assert.ok(!isLiveOpp(opp({ status: "open", stage: "Cierre" })));
    // "Cierre" como palabra completa: una etapa hipotética "Pre-cierre" no gana.
    assert.equal(statusBucket(opp({ status: "open", stage: "Pre-cierre" })), "abierta");
  }

  // 4. Pipeline manda: un won dentro de Leads Perdidos es perdida, una sola vez.
  {
    const o = opp({ pipeline: "perdidos", status: "won" });
    assert.equal(statusBucket(o), "perdida");
  }

  // 5. Abierta = en Ventas, ni ganada ni perdida. Es exactamente el embudo vivo.
  {
    for (const stage of ["Lead Generado", "Contactado", "Proceso Generado", "Follow Up", "Meeting/Cita"]) {
      const o = opp({ stage });
      assert.equal(statusBucket(o), "abierta", stage);
      assert.ok(isLiveOpp(o), `${stage} es viva`);
    }
  }

  // 6. Motivo: la etapa dentro de Leads Perdidos; el nativo en Ventas; si no, "Sin motivo".
  {
    assert.equal(lostReasonOf(opp({ pipeline: "perdidos", stage: "No Contestó 5to contacto" })), "No Contestó 5to contacto");
    assert.equal(lostReasonOf(opp({ pipeline: "perdidos", stage: "  Equivocado " })), "Equivocado", "se recorta");
    assert.equal(lostReasonOf(opp({ pipeline: "perdidos", stage: "Unknown" })), NO_REASON_LABEL, "la etapa no resuelta no es un motivo");
    assert.equal(lostReasonOf(opp({ status: "lost", lostReason: "Sin presupuesto" })), "Sin presupuesto");
    assert.equal(lostReasonOf(opp({ status: "lost" })), NO_REASON_LABEL);
    assert.equal(lostReasonOf(opp({ status: "abandoned", lostReason: "" })), NO_REASON_LABEL);
  }

  // 7. Campaña: utmCampaign tal cual, o la cubeta centinela.
  {
    assert.equal(campaignOf(opp({ campaignName: "Cellarium Formulario Junio 25 V1" })), "Cellarium Formulario Junio 25 V1");
    assert.equal(campaignOf(opp({ campaignName: "  " })), NO_CAMPAIGN_LABEL);
    assert.equal(campaignOf(opp({})), NO_CAMPAIGN_LABEL);
  }

  console.log("✅ lib/cellarium-rules.ts — all assertions passed");
}

main();
