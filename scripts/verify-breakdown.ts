// Verification for lib/opportunity-breakdown.ts — la agregación de
// "Oportunidades por estado" y los helpers de mes y de grafía.
// Correr: pnpm verify:breakdown
//
// Dos cosas justifican el script. Una: las cubetas de estado se apoyan en
// isLostOpp()/isWonOpp(), y una regresión ahí mueve leads de una barra a otra
// sin que nada truene. Dos: categoryKey() normaliza texto libre sucio
// (`No contesta` vs `NO CONTESTA`), y si deja de unir dos grafías la tabla de
// motivos muestra dos filas chicas donde debía haber una grande.
//
// Envuelto en main() en vez de top-level await: este paquete es CJS.
import assert from "node:assert/strict";
import type { Opportunity } from "../lib/types";
import {
  buildStatusByMonth,
  categoryKey,
  NO_DATE_KEY,
  statusBucket,
} from "../lib/opportunity-breakdown";

let seq = 0;

// Oportunidad mínimamente válida; solo importan los campos que lee el módulo.
function opp(o: {
  createdAt?: string;
  status?: Opportunity["status"];
  stage?: string;
  fields?: Record<string, string | string[]>;
}): Opportunity {
  return {
    id: `o${++seq}`,
    name: `Opp ${seq}`,
    pipelineId: "pipe-1",
    pipelineStageId: "stage-1",
    status: o.status ?? "open",
    createdAt: o.createdAt ?? "2026-06-15T12:00:00.000Z",
    contactId: `c${seq}`,
    value: 0,
    stage: o.stage ?? "Lead Generado",
    pipelineName: "Ventas",
    customFieldsResolved: o.fields,
  };
}

function main() {
  // 1. Cubetas de estado: perdida por pipeline o status, ganada por isWonOpp.
  //    Los casos de borde de Cellarium viven en verify-cellarium; aquí solo se
  //    asegura que ESTA función los delega y no reimplementa nada.
  {
    assert.equal(statusBucket(opp({ status: "won" })), "ganada");
    assert.equal(statusBucket(opp({ status: "open", stage: "Cierre" })), "ganada", "la etapa Cierre gana sin cambiar el status");
    assert.equal(statusBucket(opp({ status: "lost", stage: "Cierre" })), "perdida", "un lost explícito nunca es ganada");
    assert.equal(statusBucket(opp({ status: "abandoned" })), "perdida", "abandoned se pliega en perdida");
    assert.equal(statusBucket(opp({ status: "open", stage: "Contactado" })), "abierta");
    assert.equal(
      statusBucket({ ...opp({ status: "open" }), pipelineName: "Leads Perdidos" }),
      "perdida",
      "vivir en Leads Perdidos es perdida aunque el status diga open"
    );
  }

  // 2. Meses: relleno de huecos intermedios y fila "Sin fecha".
  {
    const won = opp({ createdAt: "2026-01-10T12:00:00.000Z", status: "won" });
    const rows = buildStatusByMonth([
      won,
      opp({ createdAt: "2026-04-02T12:00:00.000Z", status: "lost" }),
      opp({ createdAt: "2026-04-20T12:00:00.000Z", status: "open", stage: "Follow Up" }),
      opp({ createdAt: "" }),
      opp({ createdAt: "no es una fecha" }),
    ]);

    assert.deepEqual(
      rows.map((r) => r.key),
      ["2026-01", "2026-02", "2026-03", "2026-04", NO_DATE_KEY],
      "feb y mar se rellenan en cero para que el eje no mienta sobre la continuidad"
    );
    assert.equal(rows[1].total, 0, "un mes rellenado va vacío");
    assert.equal(rows[0].ganada, 1);
    assert.equal(rows[3].perdida, 1);
    assert.equal(rows[3].abierta, 1);
    assert.equal(rows[4].total, 2, "createdAt vacío e ilegible caen ambos en Sin fecha");
    assert.deepEqual(rows[0].ids.ganada, [won.id], "los ids del drill-down viajan con la cubeta");
    assert.equal(rows[rows.length - 1].label, "Sin fecha");
  }

  // 2b. Relleno cruzando el fin de año.
  {
    const rows = buildStatusByMonth([
      opp({ createdAt: "2025-11-05T12:00:00.000Z" }),
      opp({ createdAt: "2026-01-05T12:00:00.000Z" }),
    ]);
    assert.deepEqual(rows.map((r) => r.key), ["2025-11", "2025-12", "2026-01"]);
    assert.equal(rows[0].label, "nov 2025");
    assert.equal(rows[2].label, "ene 2026");
  }

  // 2c. Sin datos, y solo-sin-fecha.
  {
    assert.deepEqual(buildStatusByMonth([]), []);
    const only = buildStatusByMonth([opp({ createdAt: "" })]);
    assert.deepEqual(only.map((r) => r.key), [NO_DATE_KEY]);
  }

  // 3. La clave de agrupamiento une las variantes de grafía.
  {
    assert.equal(categoryKey("Walk-in"), categoryKey("Walk In"));
    assert.equal(categoryKey("Activo Seo"), categoryKey("Activo SEO"));
    assert.equal(categoryKey("WHATSAPP"), categoryKey("WhatsApp"));
    assert.equal(categoryKey("Correo electrónico"), "correo electronico", "quita acentos");
    assert.notEqual(categoryKey("Meta"), categoryKey("Mailing"));
  }

  // 4. Conjunto vacío.
  {
    assert.deepEqual(buildStatusByMonth([]), []);
  }

  console.log("verify-breakdown: all assertions passed");
}

main();
