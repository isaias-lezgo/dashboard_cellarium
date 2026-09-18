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
  isNoCampaign,
  NO_CAMPAIGN_BUCKETS,
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
  sessionSource?: string;
  attributionMedium?: string;
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
    sessionSource: o.sessionSource,
    attributionMedium: o.attributionMedium,
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

  // 7. Campaña: utmCampaign tal cual; sin él, UNA de cuatro cubetas centinela
  //    según cómo llegó el lead. Todas empiezan con "Sin campaña" para que
  //    isMissingLabel() las tiña y isNoCampaign() las reconozca.
  {
    assert.equal(campaignOf(opp({ campaignName: "Cellarium Formulario Junio 25 V1" })), "Cellarium Formulario Junio 25 V1");
    assert.ok(!isNoCampaign("Cellarium Formulario Junio 25 V1"));
    // Pauta pagada que perdió el utm_campaign: la cubeta que le importa a la agencia.
    assert.equal(campaignOf(opp({ sessionSource: "Paid Social", attributionMedium: "facebook" })), NO_CAMPAIGN_BUCKETS.paid);
    assert.equal(campaignOf(opp({ sessionSource: "paid social", attributionMedium: "whatsapp" })), NO_CAMPAIGN_BUCKETS.paid, "sin mayúsculas");
    // Orgánico / mensaje directo.
    assert.equal(campaignOf(opp({ sessionSource: "Social media", attributionMedium: "whatsapp_coex" })), NO_CAMPAIGN_BUCKETS.organic);
    assert.equal(campaignOf(opp({ sessionSource: "Social media", attributionMedium: "instagram" })), NO_CAMPAIGN_BUCKETS.organic);
    // Importación / captura manual: por sesión "CRM UI" o por medio.
    assert.equal(campaignOf(opp({ sessionSource: "CRM UI", attributionMedium: "csv_import" })), NO_CAMPAIGN_BUCKETS.imported);
    assert.equal(campaignOf(opp({ attributionMedium: "manual" })), NO_CAMPAIGN_BUCKETS.imported);
    // Todo lo demás (correo, formulario web, sin dato).
    assert.equal(campaignOf(opp({ sessionSource: "Other" })), NO_CAMPAIGN_BUCKETS.other);
    assert.equal(campaignOf(opp({ campaignName: "  " })), NO_CAMPAIGN_BUCKETS.other);
    assert.equal(campaignOf(opp({})), NO_CAMPAIGN_BUCKETS.other);
    for (const label of Object.values(NO_CAMPAIGN_BUCKETS)) {
      assert.ok(isNoCampaign(label), label);
      assert.ok(label.startsWith(NO_CAMPAIGN_LABEL), `${label} empieza con la centinela`);
    }
    // El orden de la lista es el de presentación: pagado primero, otro al final.
    assert.deepEqual(Object.keys(NO_CAMPAIGN_BUCKETS), ["paid", "organic", "imported", "other"]);
  }

  console.log("✅ lib/cellarium-rules.ts — all assertions passed");
}

main();
