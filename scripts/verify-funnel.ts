// Verification for lib/funnel.ts — los pasos del embudo. Correr: pnpm verify:funnel
//
// GHL no guarda historial de etapas, así que el embudo cuenta dónde ESTÁ cada
// oportunidad hoy, no por dónde pasó. Lo que se asevera: el orden del pipeline
// se respeta, una etapa vacía se dibuja en cero, la etapa "Cierre" NO es un paso
// (sus oportunidades son ganadas) y el porcentaje lleva a las perdidas en el
// denominador. Envuelto en main(): este paquete es CJS.
import assert from "node:assert/strict";
import type { Opportunity } from "../lib/types";
import { LOST_PIPELINE, VENTAS_PIPELINE } from "../lib/cellarium-rules";
import { buildFunnel } from "../lib/funnel";

const STAGES = ["Lead Generado", "Contactado", "Proceso Generado", "Follow Up", "Meeting/Cita", "Cierre"];
let seq = 0;
function opp(o: { lost?: boolean; status?: Opportunity["status"]; stage?: string }): Opportunity {
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
  };
}

function main() {
  // 1. Un paso por etapa de Ventas (menos Cierre), luego Ganadas, luego Perdidas.
  {
    const f = buildFunnel(
      [
        opp({ stage: "Lead Generado" }),
        opp({ stage: "Lead Generado" }),
        opp({ stage: "contactado" }),
        opp({ stage: "Meeting/Cita" }),
        opp({ stage: "Cierre" }),
        opp({ status: "won", stage: "Proceso Generado" }),
        opp({ lost: true }),
        opp({ status: "abandoned", stage: "Contactado" }),
      ],
      STAGES
    );
    assert.equal(f.total, 8);
    assert.deepEqual(
      f.steps.map((s) => s.label),
      ["Lead Generado", "Contactado", "Proceso Generado", "Follow Up", "Meeting/Cita", "Ganadas", "Perdidas"]
    );
    assert.deepEqual(f.steps.map((s) => s.kind), ["stage", "stage", "stage", "stage", "stage", "won", "lost"]);
    assert.deepEqual(f.steps.map((s) => s.count), [2, 1, 0, 0, 1, 2, 2]);
    assert.equal(f.steps[0].pct, 25);
    assert.equal(f.steps[5].pct, 25);
    assert.equal(f.steps[2].oppIds.length, 0, "etapa vacía se dibuja en cero");
    // Todas las oportunidades caen en exactamente un paso.
    assert.equal(f.steps.reduce((s, x) => s + x.count, 0), f.total);
  }

  // 2. Una etapa que traiga una oportunidad pero que el embudo no declare se
  //    agrega al final de las etapas, antes de Ganadas.
  {
    const f = buildFunnel([opp({ stage: "Etapa vieja" }), opp({})], ["Lead Generado"]);
    assert.deepEqual(f.steps.map((s) => s.label), ["Lead Generado", "Etapa vieja", "Ganadas", "Perdidas"]);
  }

  // 3. Vacío: las etapas se dibujan igual, en cero.
  {
    const f = buildFunnel([], STAGES);
    assert.equal(f.total, 0);
    assert.equal(f.steps.length, 7);
    assert.ok(f.steps.every((s) => s.count === 0 && s.pct === 0));
  }

  console.log("✅ lib/funnel.ts — all assertions passed");
}

main();
