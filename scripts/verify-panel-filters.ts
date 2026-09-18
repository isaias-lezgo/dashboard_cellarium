// Verification for lib/panel-filters.ts — los dos filtros globales de la barra:
// asesor y campaña. Correr: pnpm verify:filters
//
// Un filtro silenciosamente mal se ve igual que uno bien: números más chicos.
// Envuelto en main() en vez de top-level await: este paquete es CJS.
import assert from "node:assert/strict";
import type { Opportunity } from "../lib/types";
import { NO_CAMPAIGN_LABEL } from "../lib/cellarium-rules";
import {
  activeFilterCount,
  ADVISORS,
  advisorKeyOf,
  applyPanelFilters,
  campaignOptions,
  EMPTY_PANEL_FILTERS,
} from "../lib/panel-filters";
import { scopeOpportunities } from "../lib/panel-scope";

let seq = 0;
function opp(o: { assignedTo?: string; campaignName?: string; pipelineId?: string }): Opportunity {
  return {
    id: `o${++seq}`,
    name: `Opp ${seq}`,
    pipelineId: o.pipelineId ?? "ImCASVNiiPqszAbyXhmf",
    pipelineStageId: "s",
    status: "open",
    createdAt: "2026-06-15T12:00:00.000Z",
    contactId: `c${seq}`,
    value: 0,
    stage: "Lead Generado",
    pipelineName: "Ventas",
    assignedTo: o.assignedTo,
    campaignName: o.campaignName,
  };
}

function main() {
  // 1. Los cinco asesores con cartera, por nombre de pila sin acentos.
  {
    assert.equal(ADVISORS.length, 5);
    assert.equal(advisorKeyOf(opp({ assignedTo: "Carla Moreno" })), "carla");
    assert.equal(advisorKeyOf(opp({ assignedTo: "VERÓNICA González Díaz Barreiro" })), "veronica");
    assert.equal(advisorKeyOf(opp({ assignedTo: "María Berrueta Zapata" })), "maria");
    assert.equal(advisorKeyOf(opp({ assignedTo: "Roberto Mendoza" })), "roberto");
    assert.equal(advisorKeyOf(opp({ assignedTo: "Francisco Maza" })), "francisco");
    assert.equal(advisorKeyOf(opp({ assignedTo: "Aurelio Cadena Rodriguez" })), undefined, "no es asesor");
    assert.equal(advisorKeyOf(opp({})), undefined);
  }

  // 2. Opciones de campaña: por volumen desc, "Sin campaña" al final y en gris.
  {
    const opts = campaignOptions([
      opp({ campaignName: "B" }),
      opp({ campaignName: "A" }),
      opp({ campaignName: "A" }),
      opp({}),
    ]);
    assert.deepEqual(opts.map((o) => o.value), ["A", "B", NO_CAMPAIGN_LABEL]);
    assert.equal(opts[0].count, 2);
    assert.equal(opts[2].muted, true);
    assert.deepEqual(campaignOptions([]), []);
    assert.deepEqual(
      campaignOptions([opp({ campaignName: "A" })]).map((o) => o.muted ?? false),
      [false],
      "sin huecos no hay cubeta centinela"
    );
  }

  // 3. Selección vacía = sin filtro, y devuelve la MISMA referencia.
  {
    const opps = [opp({}), opp({ assignedTo: "Carla Moreno" })];
    assert.equal(applyPanelFilters(opps, EMPTY_PANEL_FILTERS), opps);
    assert.equal(activeFilterCount(EMPTY_PANEL_FILTERS), 0);
  }

  // 4. Dentro de un menú OR; entre menús AND; la centinela es seleccionable.
  {
    const a = opp({ assignedTo: "Carla Moreno", campaignName: "X" });
    const b = opp({ assignedTo: "Roberto Mendoza", campaignName: "X" });
    const c = opp({ assignedTo: "Carla Moreno" });
    const opps = [a, b, c];
    assert.deepEqual(applyPanelFilters(opps, { asesores: ["carla"], campanas: [] }), [a, c]);
    assert.deepEqual(applyPanelFilters(opps, { asesores: ["carla", "roberto"], campanas: ["X"] }), [a, b]);
    assert.deepEqual(applyPanelFilters(opps, { asesores: [], campanas: [NO_CAMPAIGN_LABEL] }), [c]);
    assert.deepEqual(applyPanelFilters(opps, { asesores: ["maria"], campanas: [] }), []);
    assert.equal(activeFilterCount({ asesores: ["carla", "roberto"], campanas: ["X"] }), 3);
  }

  // 5. El scope del panel toma los DOS pipelines y deja fuera cualquier otro.
  {
    const v = opp({ pipelineId: "ImCASVNiiPqszAbyXhmf" });
    const l = opp({ pipelineId: "QaCg8OLw1hiQPs2dhsAA" });
    const x = opp({ pipelineId: "otro" });
    assert.deepEqual(scopeOpportunities([v, l, x], "cellarium", []), [v, l]);
    // Por nombre cuando el catálogo trae ids distintos.
    const pipelines = [
      { id: "new-v", name: "ventas", stages: [] },
      { id: "new-l", name: "Leads perdidos", stages: [] },
    ];
    const v2 = opp({ pipelineId: "new-v" });
    const l2 = opp({ pipelineId: "new-l" });
    assert.deepEqual(scopeOpportunities([v, v2, l2], "cellarium", pipelines), [v2, l2]);
  }

  console.log("✅ lib/panel-filters.ts + lib/panel-scope.ts — all assertions passed");
}

main();
