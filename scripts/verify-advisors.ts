// Verificación de lib/advisor-breakdown.ts — la matriz asesor × etapa de
// "Oportunidades por asesor". Correr: pnpm verify:advisors
//
// Justifica el script el hecho de que la tabla es la única vista del panel donde
// se compara el desempeño de PERSONAS: un conteo mal asignado no se ve raro en
// pantalla, se ve como que alguien trabajó menos. Y el orden de las columnas sale
// del embudo, no de los datos, así que una etapa que se cae de la lista
// desaparecería en silencio junto con sus registros.
//
// Envuelto en main() en vez de top-level await: este paquete es CJS.
import assert from "node:assert/strict";
import type { Opportunity, Pipeline } from "../lib/types";
import { isInLostPipeline } from "../lib/cellarium-rules";
import {
  buildAdvisorMatrix,
  LOST_STAGE_LABEL,
  NO_ADVISOR_LABEL,
  OTHER_STAGE_LABEL,
  panelStageOrder,
  stageKind,
} from "../lib/advisor-breakdown";

let seq = 0;

// Etapas reales del pipeline Ventas de Cellarium, en orden. La tabla les suma
// la columna única "Perdidas" (LOST_STAGE_LABEL) para lo que vive en Leads Perdidos.
const VENTAS_STAGES = [
  "Lead Generado",
  "Contactado",
  "Proceso Generado",
  "Follow Up",
  "Meeting/Cita",
  "Cierre",
];
const STAGES = [...VENTAS_STAGES, LOST_STAGE_LABEL];

function opp(o: {
  advisor?: string;
  stage?: string;
  status?: Opportunity["status"];
}): Opportunity {
  return {
    id: `o${++seq}`,
    name: `Opp ${seq}`,
    pipelineId: "ImCASVNiiPqszAbyXhmf",
    pipelineStageId: "stage-1",
    status: o.status ?? "open",
    createdAt: "2026-06-15T12:00:00.000Z",
    contactId: `c${seq}`,
    value: 0,
    stage: o.stage ?? "Lead Generado",
    pipelineName: "Ventas",
    assignedTo: o.advisor,
  };
}

const rowFor = (m: ReturnType<typeof buildAdvisorMatrix>, advisor: string) => {
  const r = m.rows.find((x) => x.advisor === advisor);
  assert.ok(r, `existe la fila "${advisor}" (hay: ${m.rows.map((x) => x.advisor).join(", ")})`);
  return r!;
};

function main() {
  // 1. El tipo de etapa se decide por NOMBRE, en cualquier grafía.
  {
    assert.equal(stageKind("Cierre"), "ganado");
    assert.equal(stageKind("Ganado"), "ganado");
    assert.equal(stageKind("ganada"), "ganado");
    assert.equal(stageKind("Closed Won"), "ganado");
    assert.equal(stageKind(LOST_STAGE_LABEL), "perdido");
    assert.equal(stageKind("Perdido"), "perdido");
    assert.equal(stageKind("Meeting/Cita"), "abierto");
    assert.equal(stageKind("Follow Up"), "abierto", "Follow Up es cartera en juego, no un desenlace");
  }

  // 2. Las columnas salen del embudo, no de los datos: una etapa sin un solo
  //    registro sigue apareciendo, que es justo el dato que se quiere ver.
  {
    const m = buildAdvisorMatrix([opp({ advisor: "Carla Moreno" })], STAGES);
    assert.deepEqual(m.stages, STAGES);
    assert.equal(m.totals.stages["Meeting/Cita"].count, 0, "columna vacía, pero presente");
  }

  // 3. Una etapa que traen los datos y el embudo ya no declara NO se pierde:
  //    se agrega como columna extra al final.
  {
    const m = buildAdvisorMatrix(
      [opp({ advisor: "Roberto Mendoza", stage: "Etapa Retirada" })],
      STAGES
    );
    assert.deepEqual(m.stages.slice(-1), ["Etapa Retirada"]);
    assert.equal(m.totals.total, 1, "el registro sigue contando en el total");
    assert.equal(rowFor(m, "Roberto Mendoza").stages["Etapa Retirada"].count, 1);
  }

  // 3b. Etapa vacía o solo espacios cae en "Otra etapa" en vez de desaparecer.
  {
    const m = buildAdvisorMatrix([opp({ advisor: "Roberto Mendoza", stage: "   " })], STAGES);
    assert.ok(m.stages.includes(OTHER_STAGE_LABEL));
    assert.equal(rowFor(m, "Roberto Mendoza").stages[OTHER_STAGE_LABEL].count, 1);
  }

  // 3c. La etapa se une sin importar mayúsculas ni espacios sobrantes — una
  //     etapa renombrada a mano en GHL no debe partir la columna en dos.
  {
    const m = buildAdvisorMatrix(
      [
        opp({ advisor: "Carla Moreno", stage: "proceso generado" }),
        opp({ advisor: "Carla Moreno", stage: " Proceso Generado " }),
      ],
      STAGES
    );
    assert.equal(m.stages.length, STAGES.length, "no se inventó una columna nueva");
    assert.equal(rowFor(m, "Carla Moreno").stages["Proceso Generado"].count, 2);
  }

  // 4. Sin asesor: nunca se descarta, se rotula, y siempre va al final aunque sea
  //    la fila más grande de todas.
  {
    const m = buildAdvisorMatrix(
      [
        ...Array.from({ length: 5 }, () => opp({ advisor: undefined, stage: LOST_STAGE_LABEL, status: "lost" })),
        opp({ advisor: "Carla Moreno" }),
        opp({ advisor: "   " }),
      ],
      STAGES
    );
    const last = m.rows[m.rows.length - 1];
    assert.equal(last.advisor, NO_ADVISOR_LABEL);
    assert.equal(last.unassigned, true);
    assert.equal(last.total, 6, "sin campo y campo en blanco son lo mismo");
    assert.equal(m.rows[0].advisor, "Carla Moreno", "Sin asesor no compite por el primer lugar");
    assert.equal(m.totals.total, 7);
  }

  // 5. El máximo por columna excluye a "Sin asesor": normalizar el sombreado
  //    contra sus mil perdidas dejaría a los tres asesores en gris parejo.
  {
    const m = buildAdvisorMatrix(
      [
        ...Array.from({ length: 100 }, () => opp({ advisor: undefined, stage: LOST_STAGE_LABEL, status: "lost" })),
        ...Array.from({ length: 4 }, () => opp({ advisor: "Carla Moreno", stage: LOST_STAGE_LABEL, status: "lost" })),
        opp({ advisor: "Roberto Mendoza", stage: LOST_STAGE_LABEL, status: "lost" }),
      ],
      STAGES
    );
    assert.equal(m.stageMax[LOST_STAGE_LABEL], 4, "el máximo es el del mayor asesor, no el de Sin asesor");
  }

  // 6. Estatus: manda isWonOpp(), no el status crudo, y por eso la barra puede
  //    NO cuadrar con las columnas Ganado / Perdido. Es a propósito.
  {
    const m = buildAdvisorMatrix(
      [
        opp({ advisor: "Carla Moreno", stage: "Cierre", status: "open" }),
        opp({ advisor: "Carla Moreno", stage: LOST_STAGE_LABEL, status: "open" }),
        opp({ advisor: "Carla Moreno", stage: "Follow Up", status: "lost" }),
        opp({ advisor: "Carla Moreno", stage: "Meeting/Cita", status: "open" }),
      ],
      STAGES
    );
    const r = rowFor(m, "Carla Moreno");
    assert.equal(r.stages["Cierre"].count, 1);
    assert.equal(r.status.ganada.count, 1, "etapa Cierre con status open cuenta como ganada");
    assert.equal(
      r.status.perdida.count,
      1,
      "solo el status lost es pérdida: la columna Perdidas con status open sigue abierta"
    );
    assert.equal(r.status.abierta.count, 2);
    assert.equal(
      r.stages[LOST_STAGE_LABEL].count,
      1,
      "la columna Perdidas cuenta por etapa aunque el estatus diga otra cosa"
    );
    assert.equal(r.winRate, 25, "% ganadas es sobre el total de la fila, igual que el chart de tasa");
  }

  // 7. Los totales son la suma de las filas ya calculadas — una sola pasada, sin
  //    riesgo de que la fila Total cuente distinto que sus propias filas.
  {
    const m = buildAdvisorMatrix(
      [
        opp({ advisor: "Carla Moreno", stage: "Follow Up" }),
        opp({ advisor: "Roberto Mendoza", stage: "Follow Up" }),
        opp({ advisor: "Francisco Maza", stage: "Cierre", status: "won" }),
      ],
      STAGES
    );
    assert.equal(m.totals.stages["Follow Up"].count, 2);
    assert.equal(m.totals.stages["Follow Up"].oppIds.length, 2);
    assert.equal(m.totals.total, 3);
    assert.equal(
      m.totals.total,
      m.rows.reduce((s, r) => s + r.total, 0)
    );
    assert.equal(
      m.stages.reduce((s, st) => s + m.totals.stages[st].count, 0),
      m.totals.total,
      "cada oportunidad cae en exactamente una etapa: la suma horizontal cuadra"
    );
  }

  // 8. Los ids viajan con la celda — es lo que abre el drill-down.
  {
    const a = opp({ advisor: "Roberto Mendoza", stage: "Meeting/Cita" });
    const m = buildAdvisorMatrix([a], STAGES);
    assert.deepEqual(rowFor(m, "Roberto Mendoza").stages["Meeting/Cita"].oppIds, [a.id]);
    assert.deepEqual(rowFor(m, "Roberto Mendoza").status.abierta.oppIds, [a.id]);
    assert.deepEqual(rowFor(m, "Roberto Mendoza").oppIds, [a.id]);
  }

  // 9. Empate de volumen: desempate alfabético, para que el orden sea estable
  //    entre renders y no baile al cambiar el filtro de fechas.
  {
    const m = buildAdvisorMatrix(
      [
        opp({ advisor: "Roberto Mendoza" }),
        opp({ advisor: "Carla Moreno" }),
        opp({ advisor: "Francisco Maza" }),
      ],
      STAGES
    );
    assert.deepEqual(m.rows.map((r) => r.advisor), [
      "Carla Moreno",
      "Francisco Maza",
      "Roberto Mendoza",
    ]);
  }

  // 10. El orden de columnas se resuelve por NOMBRE de embudo, con el id
  //     hardcodeado solo de respaldo — misma regla que resolvePipelineId().
  {
    const pipelines: Pipeline[] = [
      { id: "otro-id-cualquiera", name: "ventas", stages: VENTAS_STAGES },
      { id: "QaCg8OLw1hiQPs2dhsAA", name: "Leads Perdidos", stages: ["Equivocado", "Otro"] },
    ];
    assert.deepEqual(panelStageOrder(pipelines, "cellarium"), VENTAS_STAGES, "gana el match por nombre, y son las etapas de VENTAS");
    assert.deepEqual(panelStageOrder(undefined, "cellarium"), [], "sin embudos, las columnas salen de los datos");
  }

  // 11. Conjunto vacío.
  {
    const m = buildAdvisorMatrix([], STAGES);
    assert.deepEqual(m.rows, []);
    assert.equal(m.totals.total, 0);
    assert.equal(m.totals.winRate, 0);
    assert.deepEqual(m.stages, STAGES, "las columnas del embudo se dibujan aunque no haya datos");
  }

  // 11. Cellarium: las perdidas del pipeline "Leads Perdidos" van a UNA columna
  //     ("Perdidas") en vez de una por motivo, y "Cierre" es etapa ganada.
  {
    assert.equal(stageKind("Cierre"), "ganado");
    assert.equal(stageKind(LOST_STAGE_LABEL), "perdido");
    const lost1 = { ...opp({ advisor: "Carla", stage: "Equivocado" }), pipelineName: "Leads Perdidos" };
    const lost2 = { ...opp({ advisor: "Carla", stage: "Datos Erróneos" }), pipelineName: "Leads Perdidos" };
    const live = opp({ advisor: "Carla", stage: "Contactado" });
    const stageOf = (o: Opportunity) => (isInLostPipeline(o) ? LOST_STAGE_LABEL : o.stage ?? "");
    const m = buildAdvisorMatrix([lost1, lost2, live], ["Lead Generado", "Contactado"], stageOf);
    assert.deepEqual(m.stages, ["Lead Generado", "Contactado", LOST_STAGE_LABEL]);
    const carla = m.rows.find((r) => r.advisor === "Carla")!;
    assert.equal(carla.stages[LOST_STAGE_LABEL].count, 2);
    assert.equal(carla.stages["Contactado"].count, 1);
    assert.equal(carla.status.perdida.count, 2);
  }

  console.log("verify-advisors: all assertions passed");
}

main();
