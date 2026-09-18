// Verification for lib/month-series.ts — el apilado por mes × dimensión que
// dibuja "Leads por campaña y mes". Correr: pnpm verify:month-series
//
// Lo que se asevera es el ORDEN de series y el plegado en "Otros": si eso se
// mueve al filtrar, el chart repinta las series y el lector pierde el hilo.
// Envuelto en main() en vez de top-level await: este paquete es CJS.
import assert from "node:assert/strict";
import type { Opportunity } from "../lib/types";
import { NO_DATE_KEY } from "../lib/opportunity-breakdown";
import { buildMonthSeries, OTROS_KEY } from "../lib/month-series";

let seq = 0;
function opp(o: { dim?: string; createdAt?: string; value?: number }): Opportunity {
  return {
    id: `o${++seq}`,
    name: `Opp ${seq}`,
    pipelineId: "p",
    pipelineStageId: "s",
    status: "open",
    createdAt: o.createdAt ?? "2026-06-15T12:00:00.000Z",
    contactId: `c${seq}`,
    value: o.value ?? 0,
    stage: "Lead Generado",
    pipelineName: "Ventas",
    campaignName: o.dim,
  };
}
const EMPTY = "Sin campaña";
const dimensionOf = (o: Opportunity) => (o.campaignName ?? "").trim() || EMPTY;

function main() {
  // 1. Conteo por mes de creación (default), series por total desc, vacía al final.
  {
    const data = buildMonthSeries(
      [
        opp({ dim: "A", createdAt: "2026-05-10T12:00:00Z" }),
        opp({ dim: "B", createdAt: "2026-06-10T12:00:00Z" }),
        opp({ dim: "B", createdAt: "2026-06-11T12:00:00Z" }),
        opp({ createdAt: "2026-06-12T12:00:00Z" }),
      ],
      { dimensionOf, emptyLabel: EMPTY }
    );
    assert.deepEqual(data.series.map((s) => s.key), ["B", "A", EMPTY]);
    assert.deepEqual(data.series.map((s) => s.kind), ["named", "named", "empty"]);
    assert.deepEqual(data.buckets.map((b) => b.key), ["2026-05", "2026-06"]);
    assert.equal(data.buckets[1].values.B, 2);
    assert.deepEqual(data.buckets[1].oppIds[EMPTY].length, 1);
    assert.equal(data.grandTotal, 4);
  }

  // 2. Cola larga: con más de maxNamed+1 dimensiones se pliega en "Otros".
  {
    const opps = ["A", "B", "C", "D", "E", "F", "G"].flatMap((d, i) =>
      Array.from({ length: 7 - i }, () => opp({ dim: d }))
    );
    const data = buildMonthSeries(opps, { dimensionOf, emptyLabel: EMPTY, maxNamed: 5 });
    assert.deepEqual(data.series.map((s) => s.key), ["A", "B", "C", "D", "E", OTROS_KEY]);
    const otros = data.series.at(-1)!;
    assert.equal(otros.kind, "otros");
    assert.equal(otros.foldedCount, 2);
    assert.equal(otros.total, 2 + 1);
  }

  // 2b. Exactamente maxNamed+1 NO se pliega: "Otros (1)" no dice nada.
  {
    const opps = ["A", "B", "C", "D", "E", "F"].map((d) => opp({ dim: d }));
    const data = buildMonthSeries(opps, { dimensionOf, emptyLabel: EMPTY, maxNamed: 5 });
    assert.equal(data.series.length, 6);
    assert.ok(data.series.every((s) => s.kind === "named"));
  }

  // 3. namedKeys manda: lo que no esté en la lista cae en "Otros" aunque pese.
  {
    const data = buildMonthSeries(
      [opp({ dim: "A" }), opp({ dim: "Z" }), opp({ dim: "Z" })],
      { dimensionOf, emptyLabel: EMPTY, namedKeys: ["A"] }
    );
    assert.deepEqual(data.series.map((s) => s.key), ["A", OTROS_KEY]);
  }

  // 4. include y monthOf y measure son configurables; sin fecha va al final.
  {
    const data = buildMonthSeries(
      [
        opp({ dim: "A", value: 10 }),
        opp({ dim: "A", value: 5, createdAt: "" }),
        opp({ dim: "B", value: 99 }),
      ],
      {
        dimensionOf,
        emptyLabel: EMPTY,
        include: (o) => o.campaignName !== "B",
        measure: "value",
      }
    );
    assert.equal(data.grandTotal, 15);
    assert.deepEqual(data.buckets.map((b) => b.key), ["2026-06", NO_DATE_KEY]);
    assert.equal(data.buckets[1].kind, "no-date");
  }

  // 5. Vacío.
  {
    const data = buildMonthSeries([], { dimensionOf, emptyLabel: EMPTY });
    assert.deepEqual(data, { series: [], buckets: [], grandTotal: 0 });
  }

  console.log("✅ lib/month-series.ts — all assertions passed");
}

main();
