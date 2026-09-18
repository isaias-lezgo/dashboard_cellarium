# Panel Cellarium — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la base heredada de VAEO en el panel de Cellarium: una pestaña con tres bloques (embudo, campañas, sin atención) que cuenta bien sobre los dos pipelines de la cuenta `hqz4e06E3n5wYIxOoZ6V`.

**Architecture:** Podar y reemplazar reglas. Un módulo nuevo (`lib/cellarium-rules.ts`) concentra lo propio de este CRM —perdida = pipeline "Leads Perdidos", ganada = `won` o etapa "Cierre", motivo = etapa del pipeline de perdidas, campaña = `utmCampaign`— y los módulos puros existentes (`opportunity-status`, `opportunity-breakdown`, `panel-scope`, `panel-filters`, `advisor-breakdown`, `stale-opportunity-matrix`, `lost-reason-matrix`) cambian de regla en su sitio para que los charts que sobreviven cuenten bien sin tocarlos. Lo que no aplica (MESH, sucursales, HubSpot, dinero) se borra. Tres charts nuevos: embudo, leads por campaña, campaña por mes.

**Tech Stack:** Next.js 16 (App Router), React, TypeScript, Recharts vía `components/ui/chart.tsx`, Tailwind, `tsx` + `node:assert/strict` para los verify scripts. Package manager **pnpm** (nunca `npm install`).

**Spec:** `docs/superpowers/specs/2026-09-17-panel-cellarium-design.md`

## Global Constraints

- **Este repo no toca VAEO.** `origin` es `dashboard_cellarium`; no agregar remotos, env vars ni links de Vercel que apunten a `vaeo`.
- `npx tsc --noEmit` es la puerta real: `next build` ignora errores de tipos. Cada tarea termina con `tsc` en verde salvo donde el plan diga explícitamente lo contrario.
- No hay framework de tests: los módulos puros se aseveran con `scripts/verify-*.ts` (`node:assert/strict`, envueltos en `main()` — el paquete es CJS y el top-level `await` truena). Se corren con `pnpm verify:<nombre>`.
- Etapas y pipelines se comparan **por nombre, sin distinguir mayúsculas**, nunca por id (el id es solo fallback).
- Toda cubeta centinela ("Sin motivo", "Sin campaña", "Sin asesor", "Sin fecha") lleva la etiqueta en `MISSING_TEXT`; la barra/segmento sigue en gris (`SERIES_NEUTRALS`). Un estado vacío NO usa `MISSING_TEXT`.
- Series apiladas: `SERIES_PALETTE` / `SERIES_NEUTRALS`, cinco tonos máximo, cola plegada en "Otros", colores fijados sobre el set SIN filtrar.
- `ChartContainer` ya envuelve en `ResponsiveContainer` — no anidar otro.
- Selección vacía en un menú de filtro = sin filtro.
- Commits en español, con el trailer `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Antes de escribir un chart nuevo (Tasks 8–10) cargar el skill `dataviz`.

## Desviaciones del spec (medidas al leer el código)

1. `lib/sync.ts` **ya** guarda `campaignName` (= `utmCampaign`), `campaign` (= `utmContent / utmCampaign`) y `adId`. No hay cambio en el sync ni en `types.ts`.
2. `Opportunity.pipelineName` viene resuelto por el sync, así que `isLostOpp(opp)` decide por nombre y `statusBucket(opp)` **conserva su firma** — ningún caller cambia.
3. La tarjeta "Contactos sin oportunidad" **no existe** en el código (solo en el `CLAUDE.md`). Se construye (Task 7).
4. `ExportReportButton` no está montado en ningún dashboard. El PDF queda fuera de alcance; no se toca `lib/report.ts`.
5. `lib/sales-series.ts` se renombra a `lib/month-series.ts` y deja de depender de `sales-pivot.ts` (que se borra). Su API pasa de `dimensionField` (custom field) a `dimensionOf` (getter).

## Mapa de archivos

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `lib/cellarium-rules.ts` | crear | perdida / viva / motivo / campaña / constantes de pipeline |
| `scripts/verify-cellarium.ts` | crear | asevera las reglas |
| `lib/opportunity-status.ts` | modificar | `WON_STAGE_PATTERN` acepta "Cierre"; exporta el patrón |
| `lib/opportunity-breakdown.ts` | modificar | `statusBucket` usa `isLostOpp`; se borran los helpers de Origen/Canal |
| `scripts/verify-breakdown.ts` | modificar | casos de Cellarium; se quitan las secciones de categorías |
| `lib/panel-scope.ts` | reescribir | un panel, dos pipelines |
| `lib/panel-filters.ts` | reescribir | asesor + campaña |
| `scripts/verify-panel-filters.ts` | reescribir | |
| `lib/month-series.ts` | crear (desde `sales-series.ts`) | apilado por mes × dimensión con getter |
| `scripts/verify-month-series.ts` | crear | |
| `lib/funnel.ts` + `scripts/verify-funnel.ts` | crear | pasos del embudo |
| `lib/campaign-breakdown.ts` + `scripts/verify-campaign.ts` | crear | campaña × estatus |
| `lib/lost-reason-matrix.ts` | modificar | columnas = campaña, filas = `lostReasonOf` |
| `lib/advisor-breakdown.ts` | modificar | opción `stageOf`; `stageKind` conoce "Cierre" |
| `lib/stale-opportunity-matrix.ts` | modificar | `isLiveOpp` en vez de `isLiveStage` |
| `components/dashboard/cellarium-dashboard.tsx` | crear (desde `vaeo-dashboard.tsx`) | |
| `components/dashboard/no-opportunity-card.tsx` | crear | |
| `components/dashboard/funnel-chart.tsx` | crear | |
| `components/dashboard/campaign-breakdown-chart.tsx` | crear | |
| `components/dashboard/campaign-month-chart.tsx` | crear | |
| `components/dashboard/dashboard-ui.tsx` | modificar | exporta `STATUS_COLORS` |
| `components/dashboard/lost-reason-matrix.tsx`, `advisor-stage-table.tsx`, `opportunity-status-chart.tsx`, `assignment-funnel-chart.tsx` | modificar | adaptaciones mínimas |
| `app/page.tsx` | modificar | una pestaña, barra asesor + campaña |
| `lib/ai-context.ts` | modificar | bloque "El negocio" |
| `CLAUDE.md` | reescribir | |
| Borrar | `mesh-dashboard.tsx`, `vaeo-dashboard.tsx`, `sales-pivot-table.tsx`, `sales-by-dimension-chart.tsx`, `lost-by-dimension-chart.tsx`, `lost-cross-matrix.tsx`, `category-breakdown-chart.tsx`, `hubspot-import-toggle.tsx`, `opportunity-win-rate-chart.tsx`, `lib/sales-pivot.ts`, `lib/sales-series.ts`, `lib/lost-cross-matrix.ts`, `lib/hubspot-import.ts`, `lib/category-filter.ts`, `scripts/verify-sales-pivot.ts`, `scripts/verify-lost-cross.ts`, `scripts/verify-category-filter.ts`, `public/vaeo-mark.png`, `public/mesh-mark.png` | |

---

### Task 1: Reglas de dominio de Cellarium

**Files:**
- Create: `lib/cellarium-rules.ts`
- Create: `scripts/verify-cellarium.ts`
- Modify: `lib/opportunity-status.ts`
- Modify: `lib/opportunity-breakdown.ts:26-37`
- Modify: `scripts/verify-breakdown.ts:59-75`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: `isWonOpp(opp)` de `lib/opportunity-status.ts`; `Opportunity` de `lib/types.ts` (campos `pipelineName`, `pipelineId`, `status`, `stage`, `lostReason`, `campaignName`).
- Produces:
  - `VENTAS_PIPELINE`, `LOST_PIPELINE: { label: string; id: string }`
  - `NO_REASON_LABEL = "Sin motivo"`, `NO_CAMPAIGN_LABEL = "Sin campaña"`
  - `isLostPipelineName(name?: string): boolean`
  - `isInLostPipeline(opp): boolean`, `isLostOpp(opp): boolean`, `isLiveOpp(opp): boolean`
  - `lostReasonOf(opp): string`, `campaignOf(opp): string`
  - `WON_STAGE_PATTERN` exportado desde `lib/opportunity-status.ts`
  - `statusBucket(opp)` con la regla nueva (misma firma).

- [ ] **Step 1: Escribir el verify que falla**

`scripts/verify-cellarium.ts`:

```ts
// Verification for lib/cellarium-rules.ts — las reglas propias del CRM de
// Cellarium. Correr: pnpm verify:cellarium
//
// La cuenta registra una pérdida MOVIENDO la oportunidad al pipeline "Leads
// Perdidos" sin tocar su `status` (620 de 1 043 siguen en "open", medido el
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
```

- [ ] **Step 2: Registrar el script y correrlo para verlo fallar**

En `package.json`, dentro de `"scripts"`, después de `"verify:sync-store"`:

```json
    "verify:cellarium": "tsx scripts/verify-cellarium.ts",
```

Run: `pnpm verify:cellarium`
Expected: FAIL — `Cannot find module '../lib/cellarium-rules'`.

- [ ] **Step 3: Exportar el patrón de ganada y aceptar "Cierre"**

`lib/opportunity-status.ts` — reemplazar la constante y su comentario:

```ts
// "Negocio Ganado" / "Negocio Ganada(s)" (es), "Won" / "Closed Won" (en), y
// "Cierre" — la última etapa del embudo Ventas de Cellarium. Word-boundary en
// "won" y "cierre" para no matchearlos como subcadena ("Pre-cierre" no gana).
export const WON_STAGE_PATTERN = /ganad[oa]|\bwon\b|\bcierre\b/i
```

- [ ] **Step 4: Crear `lib/cellarium-rules.ts`**

```ts
// Las reglas propias del CRM de Cellarium — lo que distingue a esta cuenta de
// cualquier otra subcuenta de GHL y que ningún chart debe re-inlinear.
//
// La cuenta tiene DOS pipelines y el segundo es la cubeta de perdidas: una
// oportunidad se pierde MOVIÉNDOLA a "Leads Perdidos", cuyas etapas son los
// motivos (Equivocado, No Contestó 5to contacto, Datos Erróneos…). El `status`
// de GHL no se toca en ese movimiento —620 de 1 043 perdidas seguían en "open"
// el 2026-09-17—, así que "perdida" se decide por pipeline, nunca por status.
//
// Puro y sin React para que scripts/verify-cellarium.ts lo asevere.
import type { Opportunity } from "./types"
import { isWonOpp } from "./opportunity-status"

/** Los dos pipelines de la cuenta. El id es solo fallback: se resuelve por nombre. */
export const VENTAS_PIPELINE = { label: "Ventas", id: "ImCASVNiiPqszAbyXhmf" } as const
export const LOST_PIPELINE = { label: "Leads Perdidos", id: "QaCg8OLw1hiQPs2dhsAA" } as const

/** Cubetas centinela — hueco de captura, no categoría del negocio. */
export const NO_REASON_LABEL = "Sin motivo"
export const NO_CAMPAIGN_LABEL = "Sin campaña"

function norm(s: string | undefined): string {
  return (s ?? "").trim().toLowerCase()
}

/** ¿Este nombre de pipeline es el de perdidas? Por nombre, sin mayúsculas. */
export function isLostPipelineName(name: string | undefined): boolean {
  return norm(name) === norm(LOST_PIPELINE.label)
}

/**
 * ¿La oportunidad vive en "Leads Perdidos"? El nombre manda (un pipeline
 * recreado conserva el nombre, no el id); el id solo rescata a una oportunidad
 * cuyo pipeline el sync no pudo resolver ("Unknown").
 */
export function isInLostPipeline(opp: Opportunity): boolean {
  if (isLostPipelineName(opp.pipelineName)) return true
  return norm(opp.pipelineName) === "unknown" && opp.pipelineId === LOST_PIPELINE.id
}

/**
 * Perdida = vive en Leads Perdidos (aunque `status` diga open) O el status es
 * lost/abandoned dentro de Ventas. Pipeline manda: un `won` extraviado dentro de
 * Leads Perdidos cuenta como perdida, una sola vez.
 */
export function isLostOpp(opp: Opportunity): boolean {
  if (isInLostPipeline(opp)) return true
  return opp.status === "lost" || opp.status === "abandoned"
}

/**
 * El embudo vivo: ni perdida ni ganada. Sobre el universo del panel (Ventas ∪
 * Leads Perdidos) equivale a "en Ventas y todavía en juego", que es lo que mide
 * "Oportunidades sin atención".
 */
export function isLiveOpp(opp: Opportunity): boolean {
  return !isLostOpp(opp) && !isWonOpp(opp)
}

/**
 * Motivo de pérdida legible. Dentro de Leads Perdidos es la ETAPA; en Ventas,
 * el `lostReason` nativo que ya resolvió el sync. Sin ninguno: la centinela.
 */
export function lostReasonOf(opp: Opportunity): string {
  if (isInLostPipeline(opp)) {
    const stage = (opp.stage ?? "").trim()
    return stage && norm(stage) !== "unknown" ? stage : NO_REASON_LABEL
  }
  const raw = (opp.lostReason ?? "").trim()
  return raw || NO_REASON_LABEL
}

/**
 * La campaña de Meta que trajo el lead: `campaignName` es el `utmCampaign` de la
 * PRIMERA atribución (ver firstAttr en lib/sync.ts). Sin UTM —correo, csv,
 * captura manual— cae en la centinela.
 */
export function campaignOf(opp: Opportunity): string {
  return (opp.campaignName ?? "").trim() || NO_CAMPAIGN_LABEL
}
```

- [ ] **Step 5: Cambiar `statusBucket` a la regla nueva**

En `lib/opportunity-breakdown.ts`, agregar el import debajo del de `isWonOpp`:

```ts
import { isLostOpp } from "./cellarium-rules"
```

y reemplazar el bloque de `statusBucket` (comentario + función, líneas 26-37) por:

```ts
/**
 * La cubeta de una oportunidad. "Perdida" se decide con isLostOpp() —vive en
 * "Leads Perdidos" o trae status lost/abandoned— y va PRIMERO: pipeline manda
 * sobre un `won` extraviado. "Ganada" es isWonOpp(): status won o etapa Cierre.
 *
 * `abandoned` se pliega en "perdida" a propósito — no es una venta, y una cuarta
 * serie en un apilado cuesta más legibilidad de la que aporta.
 */
export function statusBucket(opp: Opportunity): StatusBucket {
  if (isLostOpp(opp)) return "perdida"
  if (isWonOpp(opp)) return "ganada"
  return "abierta"
}
```

- [ ] **Step 6: Actualizar la sección 1 de `scripts/verify-breakdown.ts`**

Reemplazar el bloque `// 1. Cubetas de estado…` (líneas 59-75) por:

```ts
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
```

- [ ] **Step 7: Correr los verify**

Run: `pnpm verify:cellarium && pnpm verify:breakdown && pnpm verify:advisors && pnpm verify:assignment && pnpm verify:lost-matrix && npx tsc --noEmit`
Expected: los cinco `✅` y `tsc` sin salida. Si `verify-advisors` o `verify-lost-matrix` fallan por una oportunidad de prueba con `stage: "Ganado"` que ahora esperan distinto, NO cambiar la regla: ajustar el fixture y anotarlo en el commit.

- [ ] **Step 8: Commit**

```bash
git add lib/cellarium-rules.ts scripts/verify-cellarium.ts lib/opportunity-status.ts lib/opportunity-breakdown.ts scripts/verify-breakdown.ts package.json
git commit -m "feat(reglas): perdida por pipeline, ganada por Cierre, motivo y campaña de Cellarium

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Scope de un solo panel y filtros asesor + campaña

**Files:**
- Rewrite: `lib/panel-scope.ts`
- Rewrite: `lib/panel-filters.ts`
- Rewrite: `scripts/verify-panel-filters.ts`
- Delete: `lib/category-filter.ts`, `scripts/verify-category-filter.ts`
- Modify: `package.json` (quitar `verify:category-filter`)

**Interfaces:**
- Consumes: `VENTAS_PIPELINE`, `LOST_PIPELINE`, `campaignOf`, `NO_CAMPAIGN_LABEL` (Task 1).
- Produces:
  - `type PanelId = "cellarium"`; `PANEL_SCOPES.cellarium = { label: "Cellarium", funnel: VENTAS_PIPELINE, lost: LOST_PIPELINE }`
  - `resolvePipelineId(pipelines, panel): string` — **el de Ventas** (lo usa `panelStageOrder`)
  - `resolveLostPipelineId(pipelines, panel): string`
  - `scopeOpportunities(opps, panel, pipelines?): Opportunity[]` — Ventas ∪ Leads Perdidos
  - `interface PanelFilters { asesores: string[]; campanas: string[] }`, `EMPTY_PANEL_FILTERS`
  - `ADVISORS` (5), `advisorKeyOf(opp)`, `campaignOptions(opps): { value; label; count; muted? }[]`
  - `applyPanelFilters(opps, filters)`, `activeFilterCount(filters)`

**Nota:** al final de esta tarea `tsc` queda **rojo** en `app/page.tsx`, `vaeo-dashboard.tsx`, `mesh-dashboard.tsx` y los charts que se borran — Task 3 lo pone en verde. Los verify de esta tarea sí pasan.

- [ ] **Step 1: Reescribir `lib/panel-scope.ts`**

```ts
// Single source of truth for what the panel *is*.
//
// Cellarium tiene UN negocio y DOS pipelines: "Ventas" es el embudo y "Leads
// Perdidos" es donde van las perdidas (sus etapas son los motivos). El panel
// cuenta la unión de los dos: una perdida tiene que seguir contando como lead
// del mes en que entró, y un scope de un solo pipeline la haría desaparecer.
import type { Opportunity, Pipeline } from "./types"
import { LOST_PIPELINE, VENTAS_PIPELINE } from "./cellarium-rules"

export type PanelId = "cellarium"

interface PipelineRef {
  /** Nombre como se lee en GHL; también la clave de match. */
  label: string
  /** Fallback only — used when no pipeline matches by name. */
  id: string
}

export interface PanelScope {
  label: string
  /** El embudo vivo: de aquí salen las etapas del funnel y de la tabla por asesor. */
  funnel: PipelineRef
  /** La cubeta de perdidas. */
  lost: PipelineRef
}

export const PANEL_SCOPES: Record<PanelId, PanelScope> = {
  cellarium: {
    label: "Cellarium",
    funnel: VENTAS_PIPELINE,
    lost: LOST_PIPELINE,
  },
}

function resolve(pipelines: Pipeline[] | undefined, ref: PipelineRef): string {
  const match = pipelines?.find(
    (p) => p.name.trim().toLowerCase() === ref.label.toLowerCase()
  )
  return match?.id ?? ref.id
}

/**
 * El pipeline del EMBUDO (Ventas), preferring a NAME match over the hardcoded
 * id — a pipeline that gets recreated keeps its name but not its id. Es el que
 * consumen panelStageOrder() y el funnel; el de perdidas va aparte.
 */
export function resolvePipelineId(
  pipelines: Pipeline[] | undefined,
  panel: PanelId
): string {
  return resolve(pipelines, PANEL_SCOPES[panel].funnel)
}

export function resolveLostPipelineId(
  pipelines: Pipeline[] | undefined,
  panel: PanelId
): string {
  return resolve(pipelines, PANEL_SCOPES[panel].lost)
}

/** Every opportunity that belongs to the panel: Ventas ∪ Leads Perdidos. */
export function scopeOpportunities(
  opps: Opportunity[],
  panel: PanelId,
  pipelines?: Pipeline[]
): Opportunity[] {
  const funnel = resolvePipelineId(pipelines, panel)
  const lost = resolveLostPipelineId(pipelines, panel)
  return opps.filter((o) => o.pipelineId === funnel || o.pipelineId === lost)
}
```

- [ ] **Step 2: Escribir `scripts/verify-panel-filters.ts` (falla)**

```ts
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
```

Run: `pnpm verify:filters`
Expected: FAIL — `campaignOptions` no existe / `ADVISORS.length` es 3.

- [ ] **Step 3: Reescribir `lib/panel-filters.ts`**

```ts
// Los dos filtros globales de la barra: asesor y campaña.
//
// Cambian de qué oportunidades habla el panel entero, no cómo dibuja un gráfico.
// Por eso se aplican en app/page.tsx sobre el set de oportunidades ANTES del
// corte por fecha: así las slices filtradas y los sets `all*` que resuelven los
// drill-downs ven el mismo universo, y un drawer nunca puede sacar a la luz un
// registro que los gráficos excluyeron.
//
// Puro y sin React para que scripts/verify-panel-filters.ts pueda afirmarlo.
import type { Opportunity } from "./types"
import { campaignOf, NO_CAMPAIGN_LABEL } from "./cellarium-rules"

/** Estado de los dos menús. Arreglo vacío = ese menú no filtra nada. */
export interface PanelFilters {
  /** Claves de asesor seleccionadas (las de ADVISORS). */
  asesores: string[]
  /** Campañas seleccionadas tal cual las devuelve campaignOf(); NO_CAMPAIGN_LABEL alcanza a los sin dato. */
  campanas: string[]
}

export const EMPTY_PANEL_FILTERS: PanelFilters = {
  asesores: [],
  campanas: [],
}

/**
 * Los cinco usuarios que llevan cartera (medido 2026-09-17: Carla 982, Roberto
 * 336, Francisco 232, Verónica 135, María 29). Los otros cuatro de la subcuenta
 * son dirección y no tienen oportunidades; ofrecerlos sería ruido.
 *
 * `key` es el primer nombre normalizado, que es también con lo que se hace el
 * match: si alguien corrige un apellido en GHL el filtro no debe dejar de
 * funcionar en silencio. Los cinco primeros nombres son distintos entre sí.
 */
export const ADVISORS = [
  { key: "carla", label: "Carla Moreno" },
  { key: "roberto", label: "Roberto Mendoza" },
  { key: "francisco", label: "Francisco Maza" },
  { key: "veronica", label: "Verónica González" },
  { key: "maria", label: "María Berrueta" },
] as const

export type AdvisorKey = (typeof ADVISORS)[number]["key"]

/** Sin acentos y en minúsculas, para comparar nombres capturados a mano. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
}

/** Clave del asesor asignado, o undefined si no es ninguno de los cinco. */
export function advisorKeyOf(opp: Opportunity): AdvisorKey | undefined {
  const first = normalize(opp.assignedTo ?? "").split(/\s+/)[0]
  if (!first) return undefined
  return ADVISORS.find((a) => a.key === first)?.key
}

export interface CampaignOption {
  value: string
  label: string
  count: number
  /** true solo en la cubeta "Sin campaña", que va al final y en gris. */
  muted?: boolean
}

/**
 * Las campañas presentes en el set, por volumen descendente, con "Sin campaña"
 * siempre al final — no es una campaña, pero deja esos registros alcanzables
 * desde la barra. Se calcula sobre el set SIN los filtros de panel puestos.
 */
export function campaignOptions(opps: Opportunity[]): CampaignOption[] {
  const counts = new Map<string, number>()
  for (const o of opps) {
    const c = campaignOf(o)
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  const named = [...counts.entries()]
    .filter(([k]) => k !== NO_CAMPAIGN_LABEL)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .map(([value, count]) => ({ value, label: value, count }))
  const missing = counts.get(NO_CAMPAIGN_LABEL) ?? 0
  return missing > 0
    ? [...named, { value: NO_CAMPAIGN_LABEL, label: NO_CAMPAIGN_LABEL, count: missing, muted: true }]
    : named
}

/**
 * Dentro de un menú los valores son OR; entre los dos menús es AND. Un menú sin
 * selección no filtra: es el estado inicial. Deliberadamente NO se usa "todas
 * seleccionadas" como estado neutro — con esa convención, una campaña nueva en
 * el CRM quedaría fuera de un filtro que el usuario cree que no tiene puesto.
 */
export function applyPanelFilters(
  opps: Opportunity[],
  filters: PanelFilters
): Opportunity[] {
  const byAsesor = filters.asesores.length > 0
  const byCampana = filters.campanas.length > 0
  // Misma referencia cuando no hay nada que filtrar: una copia nueva
  // invalidaría los memos aguas abajo.
  if (!byAsesor && !byCampana) return opps

  const asesores = new Set(filters.asesores)
  const campanas = new Set(filters.campanas)

  return opps.filter((o) => {
    if (byAsesor) {
      const key = advisorKeyOf(o)
      if (!key || !asesores.has(key)) return false
    }
    if (byCampana && !campanas.has(campaignOf(o))) return false
    return true
  })
}

/** Cuántas opciones hay marcadas en total — alimenta el aviso de "filtros activos". */
export function activeFilterCount(filters: PanelFilters): number {
  return filters.asesores.length + filters.campanas.length
}
```

- [ ] **Step 4: Borrar el filtro de categorías y su script**

```bash
git rm -q lib/category-filter.ts scripts/verify-category-filter.ts
```

Quitar de `package.json` la línea `"verify:category-filter": "tsx scripts/verify-category-filter.ts",`.

- [ ] **Step 5: Correr los verify**

Run: `pnpm verify:filters && pnpm verify:cellarium`
Expected: dos `✅`. (`tsc` está rojo por `app/page.tsx` y los dashboards viejos — esperado; Task 3.)

- [ ] **Step 6: Commit**

```bash
git add lib/panel-scope.ts lib/panel-filters.ts scripts/verify-panel-filters.ts package.json
git commit -m "feat(scope): un panel sobre Ventas ∪ Leads Perdidos; filtros de asesor y campaña

tsc queda rojo hasta que app/page.tsx pase a una pestaña (siguiente commit).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Una pestaña, un dashboard, y la poda

**Files:**
- Create: `components/dashboard/cellarium-dashboard.tsx` (desde `vaeo-dashboard.tsx`)
- Rename: `lib/sales-series.ts` → `lib/month-series.ts` (reescrito)
- Create: `scripts/verify-month-series.ts`
- Modify: `app/page.tsx`
- Modify: `package.json`
- Delete: ver lista abajo

**Interfaces:**
- Consumes: Task 2 (`PanelFilters`, `campaignOptions`, `ADVISORS`, `scopeOpportunities`), `monthKeyOf`/`monthLabelOf`/`NO_DATE_KEY`/`NO_DATE_LABEL` de `lib/opportunity-breakdown.ts`.
- Produces:
  - `CellariumDashboard` con la **misma** prop surface que tenía `VaeoDashboard` (`CellariumDashboardProps`).
  - `buildMonthSeries(opps, opts: MonthSeriesOptions): MonthSeriesData` con `MonthSeriesOptions = { dimensionOf: (opp) => string; emptyLabel: string; maxNamed?; namedKeys?; include?; monthOf?; measure? }`, tipos `SeriesEntry`, `MonthBucket`, `MonthSeriesData`, constantes `OTROS_KEY`, `DEFAULT_MAX_NAMED`.

- [ ] **Step 1: Borrar lo que no aplica**

```bash
git rm -q components/dashboard/mesh-dashboard.tsx \
  components/dashboard/sales-pivot-table.tsx \
  components/dashboard/sales-by-dimension-chart.tsx \
  components/dashboard/lost-by-dimension-chart.tsx \
  components/dashboard/lost-cross-matrix.tsx \
  components/dashboard/category-breakdown-chart.tsx \
  components/dashboard/hubspot-import-toggle.tsx \
  components/dashboard/opportunity-win-rate-chart.tsx \
  lib/sales-pivot.ts lib/lost-cross-matrix.ts lib/hubspot-import.ts \
  scripts/verify-sales-pivot.ts scripts/verify-lost-cross.ts \
  public/vaeo-mark.png public/mesh-mark.png
git mv components/dashboard/vaeo-dashboard.tsx components/dashboard/cellarium-dashboard.tsx
git mv lib/sales-series.ts lib/month-series.ts
```

En `package.json` quitar `"verify:pivot"` y `"verify:lost-cross"`, y agregar:

```json
    "verify:month-series": "tsx scripts/verify-month-series.ts",
```

(`opportunity-win-rate-chart.tsx` se borra porque con 4 ganadas en 15 meses un win rate es ruido; el spec no lo lista entre los que sobreviven. Recuperable de git.)

- [ ] **Step 2: Escribir `scripts/verify-month-series.ts` (falla)**

```ts
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
```

Run: `pnpm verify:month-series`
Expected: FAIL — `buildMonthSeries` no existe.

- [ ] **Step 3: Reescribir `lib/month-series.ts`**

Conservar el cuerpo de `buildSalesSeries` (pases 1 y 2, orden de series, plegado, orden de buckets) y cambiar solo la cabecera, las opciones y la lectura de la dimensión. El archivo completo:

```ts
// Agregación detrás de las barras apiladas por mes: un eje X mensual y una
// serie por valor de una dimensión (hoy: la campaña), con la cola larga plegada
// en "Otros" y la cubeta vacía siempre al final.
//
// `dimensionOf` es un getter y no un nombre de campo para que la dimensión pueda
// venir de donde sea (un campo nativo, un custom field, una regla) sin duplicar
// el orden de series ni el plegado, que es lo que un segundo agregado copiaría
// y desincronizaría a la primera corrección.
import type { Opportunity } from "./types"
import { monthKeyOf, monthLabelOf, NO_DATE_KEY, NO_DATE_LABEL } from "./opportunity-breakdown"

/** Clave de la serie que agrupa la cola larga de una dimensión. */
export const OTROS_KEY = "Otros"

/** Máximo de series con nombre propio. Es el tamaño de la paleta validada. */
export const DEFAULT_MAX_NAMED = 5

export interface SeriesEntry {
  /** Valor de la dimensión, OTROS_KEY, o la etiqueta de la cubeta vacía. */
  key: string
  label: string
  kind: "named" | "otros" | "empty"
  /** Total del periodo — define el orden de apilado y de la leyenda. */
  total: number
  /** Cuántos valores se plegaron aquí. Solo en kind "otros". */
  foldedCount?: number
}

export interface MonthBucket {
  /** "2026-06" o NO_DATE_KEY. */
  key: string
  label: string
  kind: "month" | "no-date"
  total: number
  /** Valor por serie. Solo trae las series con valor; el resto no aparece. */
  values: Record<string, number>
  /** Ids por serie — de aquí sale el drill-down. */
  oppIds: Record<string, string[]>
}

export interface MonthSeriesData {
  /** Total desc; "Otros" y la cubeta vacía, en ese orden, al final. */
  series: SeriesEntry[]
  /** Meses ascendentes; el bucket sin fecha al final. */
  buckets: MonthBucket[]
  grandTotal: number
}

export interface MonthSeriesOptions {
  /** Valor de la dimensión de una oportunidad. Devuelve `emptyLabel` cuando no hay. */
  dimensionOf: (opp: Opportunity) => string
  /** Etiqueta de la cubeta vacía, p. ej. NO_CAMPAIGN_LABEL. */
  emptyLabel: string
  maxNamed?: number
  /**
   * Valores que conservan nombre propio; todo lo demás se pliega en "Otros".
   * Se calcula UNA vez sobre el set sin filtrar y se impone a la llamada
   * filtrada. Sin esto, una campaña que en el total anual vive dentro de
   * "Otros" reaparecería con nombre propio al filtrar a un mes donde sí es
   * grande — y el chart repintaría las series al mover el filtro.
   */
  namedKeys?: string[]
  /** Qué oportunidades entran al agregado. Default: todas. */
  include?: (opp: Opportunity) => boolean
  /**
   * Mes al que pertenece la oportunidad (`YYYY-MM`), o null si no trae fecha
   * legible — esas caen en NO_DATE_KEY. Default: el mes de `createdAt` leído
   * en hora LOCAL (monthKeyOf de opportunity-breakdown), el mismo que usa
   * "Oportunidades por estado", para que un lead caiga en el mismo mes en las
   * dos tarjetas.
   */
  monthOf?: (opp: Opportunity) => string | null
  /** Qué se acumula: conteo ("count", default) o valor monetario ("value"). */
  measure?: "value" | "count"
}

export function buildMonthSeries(
  opps: Opportunity[],
  opts: MonthSeriesOptions
): MonthSeriesData {
  const maxNamed = opts.maxNamed ?? DEFAULT_MAX_NAMED

  // Pase 1 — clasificar cada oportunidad y acumular los totales que definen el orden.
  type Entry = { bucketKey: string; dim: string; value: number; id: string }
  const entries: Entry[] = []
  const dimTotals = new Map<string, number>()
  const bucketKeys = new Set<string>()

  const include = opts.include ?? (() => true)
  const monthOf = opts.monthOf ?? ((o: Opportunity) => monthKeyOf(o.createdAt))
  const countOnly = opts.measure !== "value"

  for (const o of opps) {
    if (!include(o)) continue
    const bucketKey = monthOf(o) ?? NO_DATE_KEY
    const dim = opts.dimensionOf(o) || opts.emptyLabel
    const value = countOnly ? 1 : o.value ?? 0

    entries.push({ bucketKey, dim, value, id: o.id })
    bucketKeys.add(bucketKey)
    dimTotals.set(dim, (dimTotals.get(dim) ?? 0) + value)
  }

  // Orden de series: total desc, empates por nombre, cubeta vacía siempre al final.
  const named = [...dimTotals.keys()]
    .filter((k) => k !== opts.emptyLabel)
    .sort((a, b) => {
      const diff = (dimTotals.get(b) ?? 0) - (dimTotals.get(a) ?? 0)
      return diff !== 0 ? diff : a.localeCompare(b, "es")
    })

  // Con namedKeys manda la lista de afuera. Sin ella se pliega la cola, y solo
  // si sobra MÁS de una: "Otros (1)" no dice nada que el nombre real no diga mejor.
  let keptNames: string[]
  let foldedNames: string[]
  if (opts.namedKeys) {
    const allowed = new Set(opts.namedKeys)
    keptNames = named.filter((k) => allowed.has(k))
    foldedNames = named.filter((k) => !allowed.has(k))
  } else if (named.length > maxNamed + 1) {
    keptNames = named.slice(0, maxNamed)
    foldedNames = named.slice(maxNamed)
  } else {
    keptNames = named
    foldedNames = []
  }
  const foldedSet = new Set(foldedNames)
  const seriesKeyOf = (dim: string) => (foldedSet.has(dim) ? OTROS_KEY : dim)

  const series: SeriesEntry[] = keptNames.map((key) => ({
    key,
    label: key,
    kind: "named",
    total: dimTotals.get(key) ?? 0,
  }))
  if (foldedNames.length > 0) {
    series.push({
      key: OTROS_KEY,
      label: OTROS_KEY,
      kind: "otros",
      total: foldedNames.reduce((sum, k) => sum + (dimTotals.get(k) ?? 0), 0),
      foldedCount: foldedNames.length,
    })
  }
  if (dimTotals.has(opts.emptyLabel)) {
    series.push({
      key: opts.emptyLabel,
      label: opts.emptyLabel,
      kind: "empty",
      total: dimTotals.get(opts.emptyLabel) ?? 0,
    })
  }

  // Orden de buckets: meses ascendentes y "sin fecha" AL FINAL.
  const months = [...bucketKeys].filter((k) => k !== NO_DATE_KEY).sort()
  const orderedKeys = bucketKeys.has(NO_DATE_KEY) ? [...months, NO_DATE_KEY] : months
  const buckets: MonthBucket[] = orderedKeys.map((key) => ({
    key,
    label: key === NO_DATE_KEY ? NO_DATE_LABEL : monthLabelOf(key),
    kind: key === NO_DATE_KEY ? "no-date" : "month",
    total: 0,
    values: {},
    oppIds: {},
  }))
  const bucketByKey = new Map(buckets.map((b) => [b.key, b]))

  // Pase 2 — llenar celdas.
  let grandTotal = 0
  for (const e of entries) {
    const bucket = bucketByKey.get(e.bucketKey)
    if (!bucket) continue
    const key = seriesKeyOf(e.dim)
    bucket.values[key] = (bucket.values[key] ?? 0) + e.value
    ;(bucket.oppIds[key] ??= []).push(e.id)
    bucket.total += e.value
    grandTotal += e.value
  }

  return { series, buckets, grandTotal }
}
```

Run: `pnpm verify:month-series`
Expected: `✅`.

- [ ] **Step 4: Escribir `components/dashboard/cellarium-dashboard.tsx`**

Reemplazar el contenido entero (venía de `vaeo-dashboard.tsx`). Monta solo los charts que sobreviven; los nuevos (Tasks 7–10) se agregan después en los lugares marcados.

```tsx
"use client"

import type {
  Opportunity,
  Contact,
  Pauta,
  Task,
  Call,
  Appointment,
  Pipeline,
  Message,
} from "@/lib/types"
import type { ResolvedDateRange } from "@/lib/date-range"
import type {
  ActivityProgress,
  ActivityStatus,
} from "@/hooks/use-conversation-activity"
import { DashboardShell, SectionHeader } from "./dashboard-ui"
import { OpportunityStatusChart } from "./opportunity-status-chart"
import { AdvisorStageTable } from "./advisor-stage-table"
import { AssignmentFunnelChart } from "./assignment-funnel-chart"
import { StaleOpportunityMatrix } from "./stale-opportunity-matrix"
import { TaskBacklogChart } from "./task-backlog-chart"
import { LostReasonMatrix } from "./lost-reason-matrix"

/**
 * El panel de Cellarium: un solo negocio, tres bloques —embudo, campañas y sin
 * atención— sobre los dos pipelines de la cuenta (Ventas ∪ Leads Perdidos).
 *
 * La prop surface se hereda del panel de VAEO a propósito: `app/page.tsx`
 * alimenta las slices filtradas por fecha más los sets `all*` sin filtrar como
 * tablas de lookup para los drill-downs. Un chart nuevo se monta sin plumbing.
 *
 * Keep the filtered / `all*` pairing when you add drill-downs: charts read the
 * date-filtered arrays, joins resolve against the unfiltered ones (a record can
 * be created outside the window that puts its counterpart on screen).
 */
export interface CellariumDashboardProps {
  opportunities: Opportunity[]
  /** Unfiltered opportunities — lookup table for drill-down joins. */
  allOpportunities?: Opportunity[]
  contacts: Contact[]
  /** Unfiltered contacts — lookup table for drill-down joins. */
  allContacts?: Contact[]
  pautas?: Pauta[]
  /** Unfiltered pautas — needed for per-contact history ranking. */
  allPautas?: Pauta[]
  pipelines?: Pipeline[]
  tasks?: Task[]
  /** Tareas SIN filtrar por fecha — el rezago se mide contra hoy, no contra el periodo. */
  allTasks?: Task[]
  /**
   * Oportunidades crudas: sin filtros de panel. Solo para distinguir al contacto
   * que NO tiene ninguna oportunidad del que sí tiene pero quedó fuera de un
   * filtro. No la uses para agregar nada.
   */
  unfilteredOpportunities?: Opportunity[]
  /** Contacto → ISO del último mensaje saliente. Ausente = sin dato = cubeta más profunda. */
  conversationActivity?: Map<string, string | null>
  /** El mapa vacío NO significa "nadie escribió": hasta "ready" no se pinta la matriz. */
  activityStatus?: ActivityStatus
  activityProgress?: ActivityProgress
  onRetryActivity?: () => void
  calls?: Call[]
  messages?: Message[]
  allMessages?: Message[]
  appointments?: Appointment[]
  allAppointments?: Appointment[]
  members?: string[]
  locationId?: string
  locationName?: string
  periodLabel?: string
  dateRange?: ResolvedDateRange | null
}

export function CellariumDashboard({
  opportunities,
  contacts,
  allContacts = [],
  allOpportunities = [],
  pipelines = [],
  tasks = [],
  allTasks = [],
  unfilteredOpportunities = [],
  conversationActivity,
  activityStatus = "loading",
  activityProgress,
  onRetryActivity,
  calls = [],
  allPautas = [],
  appointments = [],
  messages = [],
  locationId,
}: CellariumDashboardProps) {
  // Todo lo que los charts por-oportunidad necesitan es idéntico, así que se
  // arma una sola vez y se esparce en cada uno.
  const shared = {
    panel: "cellarium" as const,
    opportunities,
    allOpportunities,
    contacts,
    allContacts,
    pipelines,
    tasks,
    calls,
    allPautas,
    appointments,
    messages,
    locationId,
  }

  return (
    <DashboardShell>
      {/* Task 7: <NoOpportunityCard …/> va aquí, arriba de todo. */}

      <SectionHeader title="Embudo" />
      {/* Task 8: <FunnelChart {...shared} /> va aquí. */}
      <OpportunityStatusChart {...shared} />
      <LostReasonMatrix {...shared} />
      <AdvisorStageTable {...shared} />
      <AssignmentFunnelChart {...shared} />

      <SectionHeader title="Campañas" />
      {/* Task 9: <CampaignBreakdownChart {...shared} /> · Task 10: <CampaignMonthChart {...shared} /> */}

      <SectionHeader title="Sin atención" />
      <StaleOpportunityMatrix
        {...shared}
        conversationActivity={conversationActivity}
        activityStatus={activityStatus}
        activityProgress={activityProgress}
        onRetryActivity={onRetryActivity}
      />
      <TaskBacklogChart
        {...shared}
        allTasks={allTasks}
        unfilteredOpportunities={unfilteredOpportunities}
      />
    </DashboardShell>
  )
}
```

(`SectionHeader` ya existe en `dashboard-ui.tsx`, línea 366.)

- [ ] **Step 5: Adaptar `app/page.tsx`**

Cambios exactos, en orden:

1. Imports — quitar: `VaeoDashboard`, `applyHubspotFilter`/`isHubspotImport`, `HubspotImportToggle`, `buildCategoryOptions`/`withPinnedSelection`/`CategoryOption`, `NO_VALUE_KEY`/`NO_VALUE_LABEL`, `MeshDashboard`, `collectSucursales`, `sucursalOf`, `NO_SUCURSAL`, y los iconos `MapPin`, `MessageSquare`, `Network`, `Building2`. Agregar:

```ts
import { CellariumDashboard } from "@/components/dashboard/cellarium-dashboard"
import { Warehouse } from "lucide-react"
```

y en el import de `@/lib/panel-filters` dejar: `activeFilterCount, ADVISORS, advisorKeyOf, applyPanelFilters, campaignOptions, EMPTY_PANEL_FILTERS, type PanelFilters`. Quitar el import de `scopeOpportunities` si ya no se usa (se usaba solo para `categoryBase`).

2. Tipos y títulos:

```ts
// Un solo negocio, un solo panel, más el asistente.
type DashboardTab = "cellarium" | "conversations"

const TAB_TITLES: Record<DashboardTab, string> = {
  cellarium: "Cellarium - Lezgo Suite CRM",
  conversations: "Asistente IA - Lezgo Suite CRM",
}
```

Borrar la función `toMenuOptions` completa.

3. Estado inicial: `useState<DashboardTab>("cellarium")`.

4. Borrar el bloque de HubSpot (`includeHubspot`, `hubspotScoped`, `hubspotImportCount`) y el de `sucursalOptions`, `categoryBase`, `origenOptions`, `canalOptions`. Reemplazar por:

```ts
  // Los dos filtros de alcance: asesor y campaña. Se aplican aquí, sobre el set
  // crudo y antes del corte por fecha: las slices filtradas y los sets `all*`
  // que resuelven los drill-downs tienen que ver el mismo universo.
  const [panelFilters, setPanelFilters] = useState<PanelFilters>(EMPTY_PANEL_FILTERS)
  const rawOpportunities = data?.opportunities ?? []
  const scopedOpportunities = useMemo(
    () => applyPanelFilters(rawOpportunities, panelFilters),
    [rawOpportunities, panelFilters]
  )

  // Las opciones y sus conteos se calculan SIN los filtros de panel puestos: si
  // se calcularan sobre el set ya filtrado, elegir una campaña dejaría el menú
  // con una sola opción y sin manera de agregar otra.
  const asesorOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const o of rawOpportunities) {
      const key = advisorKeyOf(o)
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return ADVISORS.map((a) => ({ value: a.key, label: a.label, count: counts.get(a.key) ?? 0 }))
  }, [rawOpportunities])

  const campanaOptions = useMemo(() => campaignOptions(rawOpportunities), [rawOpportunities])
```

Ojo: `rawOpportunities` cambia de referencia en cada render cuando `data` es undefined (`?? []`); para no invalidar los memos, declararlo como `const rawOpportunities = useMemo(() => data?.opportunities ?? [], [data?.opportunities])`.

5. En `periodLabel`, dejar solo:

```ts
    const parts = [base]
    if (panelFilters.asesores.length) {
      const names = panelFilters.asesores.map((k) => ADVISORS.find((a) => a.key === k)?.label ?? k)
      parts.push(`Asesor: ${names.join(", ")}`)
    }
    if (panelFilters.campanas.length) parts.push(`Campaña: ${panelFilters.campanas.join(", ")}`)
    return parts.join(" · ")
```

6. La pestaña: reemplazar el arreglo de tabs por

```tsx
              { id: "cellarium" as const, label: "Cellarium", icon: Warehouse, mark: null },
              { id: "conversations" as const, label: "Asistente IA", icon: Sparkles, mark: null },
```

(el render con `mark ? <Image…> : <Icon…>` se conserva; ya nada trae `mark`).

7. La barra de filtros: reemplazar el bloque `filters={…}` por

```tsx
          filters={
            <>
              <MultiSelectFilter
                label="Asesor"
                icon={UserRound}
                options={asesorOptions}
                selected={panelFilters.asesores}
                onChange={(asesores) => setPanelFilters((f) => ({ ...f, asesores }))}
              />
              <MultiSelectFilter
                label="Campaña"
                icon={Megaphone}
                options={campanaOptions}
                selected={panelFilters.campanas}
                onChange={(campanas) => setPanelFilters((f) => ({ ...f, campanas }))}
                emptyMessage="Ninguna oportunidad trae campaña"
                searchable
              />
              <ActiveFiltersPill
                count={activeFilterCount(panelFilters)}
                onClear={() => setPanelFilters(EMPTY_PANEL_FILTERS)}
              />
            </>
          }
```

y quitar la prop `trailing={…}` entera.

8. El contenido: borrar el bloque `{activeTab === "mesh" && (…)}` y cambiar `{activeTab === "vaeo" && (<VaeoDashboard …` por `{activeTab === "cellarium" && (<CellariumDashboard …` con las mismas props. Actualizar el comentario de arriba a: `{/* El panel recibe las slices filtradas por fecha para dibujar, más los sets \`all*\` sin filtrar como tablas de lookup para los drill-downs. */}` y el de la pestaña oculta a `(hidden when inactive) so the AI chat history survives switching to the Cellarium tab`.

- [ ] **Step 6: Reemplazar los usos de `PanelId` que quedaron en los charts**

Todos los charts reciben `panel: PanelId` y hacen `PANEL_SCOPES[panel].label` — siguen compilando con `"cellarium"`. Comprobar:

Run: `grep -rn '"vaeo"\|"mesh"\|PANEL_SCOPES.vaeo\|PANEL_SCOPES.mesh\|sucursalField' app components lib hooks scripts`
Expected: sin resultados. Si `lib/task-backlog.ts` o `scripts/verify-task-backlog.ts` traen `"vaeo"` como panel de prueba, cambiarlo por `"cellarium"`.

- [ ] **Step 7: tsc y verify**

Run: `npx tsc --noEmit && pnpm verify:cellarium && pnpm verify:filters && pnpm verify:month-series && pnpm verify:breakdown && pnpm verify:advisors && pnpm verify:assignment && pnpm verify:lost-matrix && pnpm verify:stale-matrix && pnpm verify:task-backlog`
Expected: `tsc` sin salida y todos `✅`. Los errores de `tsc` que aparezcan serán imports huérfanos de módulos borrados en los charts que sobreviven (`lost-reason-matrix.tsx` importa `CANAL_FIELDS`/`ORIGEN_FIELDS`, que aún existen; `advisor-stage-table.tsx` no importa nada borrado). Arreglar cada uno quitando el import; NO reintroducir un módulo borrado.

- [ ] **Step 8: Levantar la app y verla**

Run: `pnpm dev` y abrir `http://localhost:3000`, entrar con `hqz4e06E3n5wYIxOoZ6V`.
Expected: una pestaña "Cellarium", barra con Asesor + Campaña, y las tarjetas "Oportunidades por estado", "Motivos de perdido", "Oportunidades por asesor", "Leads sin asesor", "sin atención" y "Tareas" pintando datos. El header debe decir 1 865 oportunidades. En "Oportunidades por estado" la suma de perdidas debe ser 1 043 + 48 = 1 091 con "Todo el historial".

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(panel): una pestaña Cellarium; fuera MESH, sucursales, HubSpot y ventas por importe

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: "Motivos de pérdida" por campaña

**Files:**
- Modify: `lib/lost-reason-matrix.ts`
- Modify: `components/dashboard/lost-reason-matrix.tsx`
- Rewrite: `scripts/verify-lost-matrix.ts`
- Modify: `lib/opportunity-breakdown.ts` (borrar helpers de categorías)
- Modify: `scripts/verify-breakdown.ts` (borrar secciones 3b–8)

**Interfaces:**
- Consumes: `lostReasonOf`, `campaignOf`, `NO_REASON_LABEL`, `NO_CAMPAIGN_LABEL` (Task 1); `statusBucket`, `categoryKey`, `mostFrequent`.
- Produces: `buildLostReasonMatrix(opps: Opportunity[]): LostReasonMatrix` (sin segundo argumento). `LostMatrixColumn.missing` es true para "Sin campaña". `NO_REASON_LABEL` se re-exporta desde el módulo para no romper imports.

- [ ] **Step 1: Reescribir `scripts/verify-lost-matrix.ts` (falla)**

```ts
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
```

Run: `pnpm verify:lost-matrix`
Expected: FAIL (la firma vieja pide `fieldNames`; las columnas no son campañas).

- [ ] **Step 2: Reescribir `lib/lost-reason-matrix.ts`**

Conservar las interfaces (`LostMatrixColumn`, `LostMatrixCell`, `LostMatrixRow`, `LostReasonMatrix`) y `EMPTY`. Reemplazar la cabecera, los imports, `reasonOf` y `buildLostReasonMatrix`:

```ts
// El cruce detrás de la tabla "Motivos de pérdida": motivo × campaña.
//
// Puro y sin React para que scripts/verify-lost-matrix.ts lo pueda aseverar: un
// cruce mal armado da una respuesta silenciosamente equivocada —una celda que
// suma en la columna que no era se ve idéntica a una correcta.
import type { Opportunity } from "./types"
import { campaignOf, lostReasonOf, NO_CAMPAIGN_LABEL, NO_REASON_LABEL } from "./cellarium-rules"
import { categoryKey, mostFrequent, statusBucket } from "./opportunity-breakdown"

export { NO_REASON_LABEL }

/* …interfaces y EMPTY, sin cambios… */

/**
 * Matriz motivo × campaña sobre las oportunidades PERDIDAS de `opps`.
 *
 * "Perdida" es `statusBucket()` — vive en Leads Perdidos o trae lost/abandoned —
 * la misma definición que la barra roja del gráfico de estado, para que los
 * totales de las dos tarjetas cuadren. El motivo es `lostReasonOf()`: la etapa
 * dentro de Leads Perdidos, el `lostReason` nativo en Ventas.
 *
 * La campaña es un solo valor por oportunidad, así que cada una cae en UNA
 * columna y la suma horizontal de una fila es su total.
 */
export function buildLostReasonMatrix(opps: Opportunity[]): LostReasonMatrix {
  const lost = opps.filter((o) => statusBucket(o) === "perdida")
  if (lost.length === 0) return EMPTY

  // Columnas: campañas por volumen desc, "Sin campaña" al final.
  const colCounts = new Map<string, number>()
  const colIdsByLabel = new Map<string, string[]>()
  for (const o of lost) {
    const c = campaignOf(o)
    colCounts.set(c, (colCounts.get(c) ?? 0) + 1)
    ;(colIdsByLabel.get(c) ?? colIdsByLabel.set(c, []).get(c)!).push(o.id)
  }
  const colLabels = [...colCounts.keys()]
    .filter((k) => k !== NO_CAMPAIGN_LABEL)
    .sort((a, b) => (colCounts.get(b)! - colCounts.get(a)!) || a.localeCompare(b, "es"))
  if (colCounts.has(NO_CAMPAIGN_LABEL)) colLabels.push(NO_CAMPAIGN_LABEL)
  const columns: LostMatrixColumn[] = colLabels.map((label) => ({
    label,
    total: colCounts.get(label)!,
    missing: label === NO_CAMPAIGN_LABEL,
  }))
  const colIndex = new Map(colLabels.map((l, i) => [l, i]))
  const colByOpp = new Map(lost.map((o) => [o.id, colIndex.get(campaignOf(o))!]))

  // Filas: se agrupan por clave normalizada para que "No Contesta" y "No
  // contesta" no se partan en dos, y se muestra la grafía más frecuente.
  interface Group {
    spellings: Map<string, number>
    oppIds: string[]
  }
  const groups = new Map<string, Group>()
  const noReason: string[] = []
  for (const o of lost) {
    const reason = lostReasonOf(o)
    const key = reason === NO_REASON_LABEL ? "" : categoryKey(reason)
    if (key === "") {
      noReason.push(o.id)
      continue
    }
    const g: Group = groups.get(key) ?? { spellings: new Map(), oppIds: [] }
    g.spellings.set(reason, (g.spellings.get(reason) ?? 0) + 1)
    g.oppIds.push(o.id)
    groups.set(key, g)
  }

  const pctOf = (n: number) => (n / lost.length) * 100
  const buildRow = (label: string, oppIds: string[], missing: boolean): LostMatrixRow => {
    const cells: LostMatrixCell[] = columns.map(() => ({ count: 0, oppIds: [] }))
    for (const id of oppIds) {
      const i = colByOpp.get(id)!
      cells[i].count += 1
      cells[i].oppIds.push(id)
    }
    return { label, cells, total: oppIds.length, pct: pctOf(oppIds.length), oppIds, missing }
  }

  const rows: LostMatrixRow[] = [...groups.values()]
    .map((g) => buildRow(mostFrequent(g.spellings), g.oppIds, false))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"))
  if (noReason.length > 0) rows.push(buildRow(NO_REASON_LABEL, noReason, true))

  const totals: LostMatrixCell[] = columns.map((c) => ({
    count: c.total,
    oppIds: colIdsByLabel.get(c.label) ?? [],
  }))

  let maxCell = 0
  for (const row of rows) for (const cell of row.cells) if (cell.count > maxCell) maxCell = cell.count

  return { columns, rows, totals, grandTotal: lost.length, maxCell }
}
```

Run: `pnpm verify:lost-matrix`
Expected: `✅`.

- [ ] **Step 3: Adaptar `components/dashboard/lost-reason-matrix.tsx`**

- Quitar el import de `CANAL_FIELDS, ORIGEN_FIELDS`, la constante `DIMENSIONS`, el tipo `DimensionId`, el estado `dimension`/`setDimension` y la variable `dim`.
- `buildLostReasonMatrix(scoped)` con dependencia `[scoped]`.
- Título: `"Motivos de pérdida"`. Encabezado de la primera columna: `Motivo de pérdida`.
- En `actions`, borrar el `<div role="group" …>` del switch entero y dejar solo el `ScopePill` con:

```tsx
            <ScopePill
              label="Perdidas · por campaña"
              tooltip={
                <>
                  Motivo de pérdida de las oportunidades <strong>perdidas</strong> —las que
                  viven en <strong>Leads Perdidos</strong>, donde la etapa es el motivo, más
                  las marcadas perdidas o abandonadas en Ventas— cruzado contra la{" "}
                  <strong>campaña</strong> de Meta que trajo el lead. Cada oportunidad cae en
                  una sola campaña, así que la suma horizontal es el total de la fila.
                </>
              }
            />
```

- Actualizar el comentario del componente: `"Motivos de pérdida": el cruce de por qué se pierde contra qué campaña trajo el lead. Es donde se ve que "Equivocado" se lleva ~70 % de las perdidas y de qué campaña vienen.`
- El texto del botón "Ver N motivos más" y el drill (`todas las categorías` → `todas las campañas`) se conservan con ese ajuste de copy.

- [ ] **Step 4: Podar los helpers de categorías de `lib/opportunity-breakdown.ts`**

Borrar (ya nadie los importa): `ORIGEN_FIELDS`, `CANAL_FIELDS`, `NO_VALUE_LABEL`, `NO_VALUE_KEY`, `CANONICAL_LABELS`, `KEY_ALIASES`, `normalizeCategoryKey`, `cfValues`, `categoryValuesOf`, `CategoryRow`, `buildCategoryBreakdown`. Conservar `categoryKey` y `mostFrequent`. Actualizar el comentario de cabecera del archivo a: `// Agregación detrás de "Oportunidades por estado" (barras apiladas por mes) y los helpers de mes y de grafía que comparten los demás charts.`

Confirmar: `grep -rn "buildCategoryBreakdown\|categoryValuesOf\|NO_VALUE_LABEL\|NO_VALUE_KEY\|normalizeCategoryKey\|ORIGEN_FIELDS\|CANAL_FIELDS" lib components app scripts hooks` → solo `scripts/verify-breakdown.ts`.

- [ ] **Step 5: Podar `scripts/verify-breakdown.ts`**

Quitar de los imports `buildCategoryBreakdown, CANAL_FIELDS, NO_VALUE_KEY, NO_VALUE_LABEL, normalizeCategoryKey, ORIGEN_FIELDS`; borrar el helper `rowFor` y las secciones `3b` a `9` inclusive **excepto** la `3` (`categoryKey` une grafías), que se conserva. Agregar una sección de conjunto vacío para `buildStatusByMonth([])` si la `9` la cubría:

```ts
  // 4. Conjunto vacío.
  {
    assert.deepEqual(buildStatusByMonth([]), []);
  }
```

Actualizar el comentario de cabecera para que ya no hable de Origen/Canal.

- [ ] **Step 6: Verificar**

Run: `pnpm verify:breakdown && pnpm verify:lost-matrix && npx tsc --noEmit`
Expected: `✅ ✅`, `tsc` sin salida. Abrir la app: la tabla "Motivos de pérdida" muestra columnas de campaña ("Cellarium Formulario Junio 25 V1", …, "Sin campaña" en rojizo) y "Equivocado" como primera fila con ~70 %.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(perdidas): motivo de pérdida × campaña, con el motivo leído del pipeline Leads Perdidos

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Tabla por asesor — etapas de Ventas + columna "Perdidas"

**Files:**
- Modify: `lib/advisor-breakdown.ts`
- Modify: `components/dashboard/advisor-stage-table.tsx:160-166`
- Modify: `scripts/verify-advisors.ts`

**Interfaces:**
- Consumes: `isInLostPipeline` (Task 1); `WON_STAGE_PATTERN` (Task 1).
- Produces: `buildAdvisorMatrix(opps, stageOrder, stageOf?: (opp) => string)`; `LOST_STAGE_LABEL = "Perdidas"`; `stageKind("Cierre") === "ganado"`.

Sin esto, las 10 etapas de Leads Perdidos (Equivocado, Datos Erróneos, …) aparecerían como columnas extra de la tabla, y "Cierre" se teñiría como etapa abierta.

- [ ] **Step 1: Agregar los casos al verify (falla)**

Al final de `main()` en `scripts/verify-advisors.ts`, antes del `console.log`, agregar (adaptando el helper `opp` del archivo, que ya construye oportunidades; si no acepta `pipelineName`, extenderlo con ese campo opcional):

```ts
  // 7. Cellarium: las perdidas del pipeline "Leads Perdidos" van a UNA columna
  //    ("Perdidas") en vez de una por motivo, y "Cierre" es etapa ganada.
  {
    assert.equal(stageKind("Cierre"), "ganado");
    assert.equal(stageKind(LOST_STAGE_LABEL), "perdido");
    const lost1 = { ...opp({ assignedTo: "Carla", stage: "Equivocado" }), pipelineName: "Leads Perdidos" };
    const lost2 = { ...opp({ assignedTo: "Carla", stage: "Datos Erróneos" }), pipelineName: "Leads Perdidos" };
    const live = opp({ assignedTo: "Carla", stage: "Contactado" });
    const stageOf = (o: Opportunity) => (isInLostPipeline(o) ? LOST_STAGE_LABEL : o.stage ?? "")
    const m = buildAdvisorMatrix([lost1, lost2, live], ["Lead Generado", "Contactado"], stageOf);
    assert.deepEqual(m.stages, ["Lead Generado", "Contactado", LOST_STAGE_LABEL]);
    const carla = m.rows.find((r) => r.advisor === "Carla")!;
    assert.equal(carla.stages[LOST_STAGE_LABEL].count, 2);
    assert.equal(carla.stages["Contactado"].count, 1);
    assert.equal(carla.status.perdida.count, 2);
  }
```

con los imports `LOST_STAGE_LABEL, stageKind` desde `../lib/advisor-breakdown` e `isInLostPipeline` desde `../lib/cellarium-rules`.

Run: `pnpm verify:advisors`
Expected: FAIL — `LOST_STAGE_LABEL` no existe.

- [ ] **Step 2: Implementar en `lib/advisor-breakdown.ts`**

Reemplazar `stageKind` y agregar la constante:

```ts
/** Columna única para las oportunidades que viven en "Leads Perdidos". */
export const LOST_STAGE_LABEL = "Perdidas"

/**
 * Qué significa una etapa por su NOMBRE, nunca por su id — misma regla que
 * isWonOpp(): un embudo recreado conserva el nombre pero no el id.
 */
export function stageKind(stage: string): StageKind {
  if (WON_STAGE_PATTERN.test(stage)) return "ganado"
  if (/perdid[oa]s?|\blost\b/i.test(stage)) return "perdido"
  return "abierto"
}
```

con `import { WON_STAGE_PATTERN } from "./opportunity-status"`.

En `buildAdvisorMatrix`, agregar el tercer parámetro y usarlo en las dos lecturas de etapa:

```ts
export function buildAdvisorMatrix(
  opps: Opportunity[],
  stageOrder: string[],
  /** Etapa bajo la que se cuenta una oportunidad. Default: la suya. */
  stageOf: (opp: Opportunity) => string = (o) => o.stage ?? ""
): AdvisorMatrix {
```

y reemplazar `(o.stage ?? "").trim()` por `stageOf(o).trim()` en las dos apariciones (el bucle que descubre etapas y el que llena filas). Actualizar el doc-comment: `- Con \`stageOf\` el caller decide bajo qué etapa cuenta cada oportunidad; el panel de Cellarium manda todas las de "Leads Perdidos" a una sola columna "Perdidas" en vez de una por motivo.`

- [ ] **Step 3: Pasar el getter desde `advisor-stage-table.tsx`**

```tsx
    const scoped = scopeOpportunities(opportunities, panel, pipelines)
    return buildAdvisorMatrix(scoped, panelStageOrder(pipelines, panel), (o) =>
      isInLostPipeline(o) ? LOST_STAGE_LABEL : o.stage ?? ""
    )
```

con `import { isInLostPipeline } from "@/lib/cellarium-rules"` y `LOST_STAGE_LABEL` en el import de `advisor-breakdown`. Si el tooltip del `ScopePill` menciona "Ganado", "Perdido" o "Cliente Futuro", reescribirlo: `Asesor × etapa del embudo Ventas. Las oportunidades que viven en Leads Perdidos van juntas en la columna Perdidas. La barra de estatus cuenta ganadas (status won o etapa Cierre), abiertas y perdidas.`

- [ ] **Step 4: Verificar**

Run: `pnpm verify:advisors && npx tsc --noEmit`
Expected: `✅`, sin salida. En la app, la tabla muestra Lead Generado … Cierre + Perdidas; "Carla Moreno" arriba; "Sin asesor" al final.

- [ ] **Step 5: Commit**

```bash
git add lib/advisor-breakdown.ts components/dashboard/advisor-stage-table.tsx scripts/verify-advisors.ts
git commit -m "feat(asesores): las perdidas de Leads Perdidos en una sola columna; Cierre es etapa ganada

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: "Sin atención" sobre el embudo vivo de Cellarium

**Files:**
- Modify: `lib/stale-opportunity-matrix.ts:55-67,159-160`
- Modify: `scripts/verify-stale-matrix.ts:98-112`
- Modify: `components/dashboard/stale-opportunity-matrix.tsx` (tooltip)

**Interfaces:**
- Consumes: `isLiveOpp` (Task 1).
- Produces: `buildStaleMatrix` filtra con `isLiveOpp(o)`; `isLiveStage` y `CLOSED_STAGE_PATTERNS` desaparecen.

- [ ] **Step 1: Cambiar el verify (falla)**

Reemplazar el bloque de `isLiveStage` (líneas ~98-112) por un caso sobre `buildStaleMatrix` que use el helper `opp` del archivo (extenderlo con `pipelineName?` y `status?` si no los acepta):

```ts
  // 4. Universo: el embudo vivo de Cellarium. Fuera las de Leads Perdidos aunque
  //    su status diga open, fuera Cierre, fuera won/lost/abandoned.
  {
    const now = new Date("2026-09-17T12:00:00Z");
    const live = opp({ stage: "Contactado", lastStageChangeAt: "2026-09-10T00:00:00Z" });
    const inLost = { ...opp({ stage: "Equivocado", lastStageChangeAt: "2026-09-10T00:00:00Z" }), pipelineName: "Leads Perdidos" };
    const cierre = opp({ stage: "Cierre", lastStageChangeAt: "2026-09-10T00:00:00Z" });
    const won = { ...opp({ stage: "Contactado", lastStageChangeAt: "2026-09-10T00:00:00Z" }), status: "won" as const };
    const m = buildStaleMatrix([live, inLost, cierre, won], new Map(), now);
    assert.equal(m.grandTotal, 1, "solo la viva entra");
  }
```

Quitar `isLiveStage` del import.

Run: `pnpm verify:stale-matrix`
Expected: FAIL — `grandTotal` es 2 o más (la de Leads Perdidos entra porque su status es open y "Equivocado" no matchea los patrones viejos).

- [ ] **Step 2: Implementar**

En `lib/stale-opportunity-matrix.ts`, borrar `CLOSED_STAGE_PATTERNS` e `isLiveStage` con sus comentarios, agregar `import { isLiveOpp } from "./cellarium-rules"`, y en `buildStaleMatrix` reemplazar

```ts
    if (o.status !== "open") continue
    if (!isLiveStage(o.stage ?? "")) continue
```

por

```ts
    // El embudo vivo de Cellarium: ni ganada (won / Cierre) ni perdida (Leads
    // Perdidos o lost/abandoned). Ver lib/cellarium-rules.ts.
    if (!isLiveOpp(o)) continue
```

En el componente, si el tooltip del `ScopePill` menciona "Ganado", "Perdido" o "Cliente Futuro", reemplazar esa frase por: `sobre las oportunidades del embudo Ventas que siguen en juego —ni en Cierre ni en Leads Perdidos—`.

- [ ] **Step 3: Verificar**

Run: `pnpm verify:stale-matrix && npx tsc --noEmit && grep -rn "isLiveStage" lib components scripts`
Expected: `✅`, sin salida, sin resultados del grep.

- [ ] **Step 4: Commit**

```bash
git add lib/stale-opportunity-matrix.ts scripts/verify-stale-matrix.ts components/dashboard/stale-opportunity-matrix.tsx
git commit -m "feat(sin-atencion): el embudo vivo se decide con isLiveOpp, no por nombre de etapa

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Tarjeta "Contactos sin oportunidad"

**Files:**
- Create: `components/dashboard/no-opportunity-card.tsx`
- Modify: `components/dashboard/cellarium-dashboard.tsx`

**Interfaces:**
- Consumes: `KpiCard`, `ChartDrillDrawer` (`DrillState.contactItems`), `unfilteredOpportunities`.
- Produces: `NoOpportunityCard({ contacts, unfilteredOpportunities, allOpportunities, … })`.

El conjunto se calcula contra `unfilteredOpportunities` (el set crudo), no contra `allOpportunities`: con un filtro de asesor puesto, un contacto cuya única oportunidad es de otro asesor NO es un contacto sin oportunidad. Misma lección que `task-backlog.ts`.

- [ ] **Step 1: Escribir el componente**

```tsx
"use client"

import { useMemo, useState } from "react"
import { UserX } from "lucide-react"
import type { Appointment, Call, Contact, Message, Opportunity, Pauta, Task } from "@/lib/types"
import { KpiCard } from "./dashboard-ui"
import { ChartDrillDrawer, DRILL_CLOSED, type DrillState } from "./chart-drill-drawer"

export interface NoOpportunityCardProps {
  /** Contactos filtrados por fecha de creación. */
  contacts: Contact[]
  /**
   * Oportunidades CRUDAS, sin filtros de panel: un contacto cuya única
   * oportunidad quedó fuera de un filtro sigue teniendo oportunidad.
   */
  unfilteredOpportunities: Opportunity[]
  allOpportunities: Opportunity[]
  allContacts: Contact[]
  tasks?: Task[]
  calls?: Call[]
  allPautas?: Pauta[]
  appointments?: Appointment[]
  messages?: Message[]
  locationId?: string
}

/**
 * La fuga que ningún chart por-oportunidad puede ver: contactos que entraron al
 * CRM y nadie movió a un embudo. No pertenecen a ningún pipeline, así que van
 * FUERA de los agregados del panel y arriba de todo, con su propio drill-down.
 */
export function NoOpportunityCard({
  contacts,
  unfilteredOpportunities,
  allOpportunities,
  allContacts,
  tasks = [],
  calls = [],
  allPautas = [],
  appointments = [],
  messages = [],
  locationId = "",
}: NoOpportunityCardProps) {
  const [drill, setDrill] = useState<DrillState>(DRILL_CLOSED)

  const orphans = useMemo(() => {
    const withOpp = new Set(unfilteredOpportunities.map((o) => o.contactId))
    return contacts.filter((c) => !withOpp.has(c.id))
  }, [contacts, unfilteredOpportunities])

  const pct = contacts.length > 0 ? Math.round((orphans.length / contacts.length) * 100) : 0

  return (
    <>
      <KpiCard
        label="Contactos sin oportunidad"
        value={orphans.length.toLocaleString("es-MX")}
        sublabel={
          contacts.length > 0
            ? `${pct}% de ${contacts.length.toLocaleString("es-MX")} contactos del periodo · leads que nadie movió a un embudo`
            : "Sin contactos en el periodo"
        }
        icon={UserX}
        onClick={() =>
          orphans.length > 0 &&
          setDrill({
            open: true,
            title: "Contactos sin oportunidad",
            subtitle: "Creados en el periodo, sin ninguna oportunidad en el CRM",
            opportunities: [],
            contactItems: orphans,
          })
        }
      />
      <ChartDrillDrawer
        drill={drill}
        onDrillChange={setDrill}
        contacts={allContacts.length > 0 ? allContacts : contacts}
        tasks={tasks}
        calls={calls}
        allOpportunities={allOpportunities}
        allPautas={allPautas}
        appointments={appointments}
        messages={messages}
        locationId={locationId}
      />
    </>
  )
}
```

Si `ChartDrillDrawer` no lista `contactItems` cuando `opportunities` está vacío, revisar cómo lo hace `assignment-funnel-chart.tsx` o `task-backlog-chart.tsx` (ambos abren drawers de contactos) y copiar ese patrón.

- [ ] **Step 2: Montar en el dashboard**

En `cellarium-dashboard.tsx`, reemplazar el comentario `{/* Task 7 … */}` por:

```tsx
      <NoOpportunityCard
        contacts={contacts}
        unfilteredOpportunities={unfilteredOpportunities}
        allOpportunities={allOpportunities}
        allContacts={allContacts}
        tasks={tasks}
        calls={calls}
        allPautas={allPautas}
        appointments={appointments}
        messages={messages}
        locationId={locationId}
      />
```

con su import.

- [ ] **Step 3: Verificar en la app**

Run: `npx tsc --noEmit` y `pnpm dev`.
Expected: con "Todo el historial", la tarjeta muestra un número ≥ 240 (2 105 contactos − ~1 865 con oportunidad, menos los contactos con más de una); clic abre el drawer con esos contactos. Con un filtro de asesor puesto, el número NO cambia.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/no-opportunity-card.tsx components/dashboard/cellarium-dashboard.tsx
git commit -m "feat(panel): tarjeta de contactos sin oportunidad, fuera de los agregados

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Embudo de ventas

**Files:**
- Create: `lib/funnel.ts`
- Create: `scripts/verify-funnel.ts`
- Create: `components/dashboard/funnel-chart.tsx`
- Modify: `components/dashboard/dashboard-ui.tsx` (exportar `STATUS_COLORS`)
- Modify: `components/dashboard/opportunity-status-chart.tsx`, `assignment-funnel-chart.tsx` (usar `STATUS_COLORS`)
- Modify: `components/dashboard/cellarium-dashboard.tsx`, `package.json`

**Interfaces:**
- Consumes: `statusBucket`, `WON_STAGE_PATTERN`, `panelStageOrder` (de `lib/advisor-breakdown.ts`), `scopeOpportunities`.
- Produces:
  - `buildFunnel(opps, stageOrder): FunnelData` con `FunnelStep = { key; label; kind: "stage" | "won" | "lost"; count; pct; oppIds }`, `FunnelData = { steps; total }`.
  - `STATUS_COLORS: Record<StatusBucket, string>` en `dashboard-ui.tsx`.

Cargar el skill `dataviz` antes del Step 4.

- [ ] **Step 1: Escribir `scripts/verify-funnel.ts` (falla)**

```ts
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
```

En `package.json`: `"verify:funnel": "tsx scripts/verify-funnel.ts",`.

Run: `pnpm verify:funnel`
Expected: FAIL — módulo inexistente.

- [ ] **Step 2: Escribir `lib/funnel.ts`**

```ts
// Los pasos del "Embudo de ventas": una barra por etapa del pipeline Ventas, y
// abajo Ganadas y Perdidas.
//
// Es una FOTO del hoy sobre los leads del periodo: GHL no guarda el historial de
// etapas, así que se cuenta cuántos ESTÁN en cada etapa, no cuántos pasaron por
// ella. Una perdida ya no tiene etapa de Ventas (vive en Leads Perdidos), y una
// ganada tampoco (Cierre, o el status won): por eso van en pasos propios y la
// etapa "Cierre" no es un paso — sus oportunidades son las ganadas.
//
// Puro y sin React para que scripts/verify-funnel.ts lo asevere.
import type { Opportunity } from "./types"
import { statusBucket } from "./opportunity-breakdown"
import { WON_STAGE_PATTERN } from "./opportunity-status"

export type FunnelStepKind = "stage" | "won" | "lost"

export interface FunnelStep {
  key: string
  label: string
  kind: FunnelStepKind
  count: number
  /** Porcentaje sobre el total de leads del periodo (perdidas incluidas), 0–100. */
  pct: number
  oppIds: string[]
}

export interface FunnelData {
  steps: FunnelStep[]
  /** Todas las oportunidades del periodo — el denominador de cada `pct`. */
  total: number
}

export const WON_STEP_LABEL = "Ganadas"
export const LOST_STEP_LABEL = "Perdidas"

const stageKey = (s: string) => s.trim().toLowerCase()

export function buildFunnel(opps: Opportunity[], stageOrder: string[]): FunnelData {
  // Etapas del embudo en orden de pipeline, sin la de cierre (es "Ganadas").
  const stages = stageOrder.filter((s) => !WON_STAGE_PATTERN.test(s))
  const stageByKey = new Map(stages.map((s) => [stageKey(s), s]))
  const won: string[] = []
  const lost: string[] = []
  const byStage = new Map<string, string[]>(stages.map((s) => [s, []]))

  for (const o of opps) {
    const bucket = statusBucket(o)
    if (bucket === "ganada") {
      won.push(o.id)
      continue
    }
    if (bucket === "perdida") {
      lost.push(o.id)
      continue
    }
    const raw = (o.stage ?? "").trim()
    let label = stageByKey.get(stageKey(raw))
    if (!label) {
      // Una etapa que ya no está en el embudo pero sí en los datos: columna
      // extra al final, no un registro perdido.
      label = raw || "Otra etapa"
      stageByKey.set(stageKey(label), label)
      stages.push(label)
      byStage.set(label, [])
    }
    byStage.get(label)!.push(o.id)
  }

  const total = opps.length
  const pctOf = (n: number) => (total === 0 ? 0 : (n / total) * 100)
  const step = (key: string, label: string, kind: FunnelStepKind, ids: string[]): FunnelStep => ({
    key,
    label,
    kind,
    count: ids.length,
    pct: pctOf(ids.length),
    oppIds: ids,
  })

  const steps: FunnelStep[] = stages.map((s) => step(`stage:${stageKey(s)}`, s, "stage", byStage.get(s)!))
  steps.push(step("won", WON_STEP_LABEL, "won", won))
  steps.push(step("lost", LOST_STEP_LABEL, "lost", lost))
  return { steps, total }
}
```

Run: `pnpm verify:funnel`
Expected: `✅`.

- [ ] **Step 3: Exportar `STATUS_COLORS` desde `dashboard-ui.tsx`**

Debajo de `STRUCTURAL_NAVY` (línea 25):

```ts
/**
 * Colores semánticos de las tres cubetas de estatus. Verde y rojo ya significan
 * algo antes de leer la leyenda; "abierta" va en el navy estructural. Los usan
 * el apilado por estado, el de leads sin asesor, el de campañas y el embudo.
 */
export const STATUS_COLORS = {
  ganada: "#10b981",
  abierta: STRUCTURAL_NAVY,
  perdida: "#ef4444",
} as const
```

En `opportunity-status-chart.tsx`: borrar `BUCKET_COLORS` y usar `STATUS_COLORS` (importado de `./dashboard-ui`) en `chartConfig`, la leyenda y los `<Bar fill>`. En `assignment-funnel-chart.tsx` (líneas ~51-53): reemplazar los tres literales de color por `STATUS_COLORS.perdida`, `STATUS_COLORS.abierta`, `STATUS_COLORS.ganada`.

- [ ] **Step 4: Escribir `components/dashboard/funnel-chart.tsx`**

Barras horizontales en CSS (no Recharts): ocho filas, cada una un botón que abre el drill-down. El ancho relativo es respecto al paso más grande, el número y el % van a la derecha.

```tsx
"use client"

import { useMemo, useState } from "react"
import { Filter } from "lucide-react"
import type { Appointment, Call, Contact, Message, Opportunity, Pauta, Pipeline, Task } from "@/lib/types"
import { buildFunnel, type FunnelStep } from "@/lib/funnel"
import { panelStageOrder } from "@/lib/advisor-breakdown"
import { PANEL_SCOPES, scopeOpportunities, type PanelId } from "@/lib/panel-scope"
import { cn } from "@/lib/utils"
import {
  ChartCardContent,
  ChartCardHeader,
  ChartEmpty,
  ChartHint,
  DashboardCard,
  STATUS_COLORS,
  ScopePill,
} from "./dashboard-ui"
import { ChartDrillDrawer, DRILL_CLOSED, type DrillState } from "./chart-drill-drawer"

const pctFmt = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const n = (v: number) => v.toLocaleString("es-MX")

const STEP_COLOR: Record<FunnelStep["kind"], string> = {
  stage: STATUS_COLORS.abierta,
  won: STATUS_COLORS.ganada,
  lost: STATUS_COLORS.perdida,
}

export interface FunnelChartProps {
  panel: PanelId
  opportunities: Opportunity[]
  allOpportunities: Opportunity[]
  contacts: Contact[]
  allContacts: Contact[]
  pipelines?: Pipeline[]
  tasks?: Task[]
  calls?: Call[]
  allPautas?: Pauta[]
  appointments?: Appointment[]
  messages?: Message[]
  locationId?: string
}

/**
 * "Embudo de ventas": dónde está hoy cada lead del periodo. Una barra por etapa
 * de Ventas en orden de pipeline, y abajo Ganadas y Perdidas. El porcentaje es
 * sobre el total del periodo, perdidas incluidas: "el 2 % llegó a Meeting" solo
 * dice algo si el 56 % que se perdió está en el denominador.
 */
export function FunnelChart({
  panel,
  opportunities,
  allOpportunities,
  contacts,
  allContacts,
  pipelines = [],
  tasks = [],
  calls = [],
  allPautas = [],
  appointments = [],
  messages = [],
  locationId = "",
}: FunnelChartProps) {
  const [drill, setDrill] = useState<DrillState>(DRILL_CLOSED)
  const scope = PANEL_SCOPES[panel]

  const funnel = useMemo(
    () => buildFunnel(scopeOpportunities(opportunities, panel, pipelines), panelStageOrder(pipelines, panel)),
    [opportunities, panel, pipelines]
  )
  const max = useMemo(() => Math.max(1, ...funnel.steps.map((s) => s.count)), [funnel])
  const oppById = useMemo(() => new Map(allOpportunities.map((o) => [o.id, o])), [allOpportunities])

  const openDrill = (step: FunnelStep) => {
    const items = step.oppIds.map((id) => oppById.get(id)).filter((o): o is Opportunity => Boolean(o))
    if (items.length === 0) return
    setDrill({ open: true, title: step.label, subtitle: `Embudo ${scope.label}`, opportunities: items })
  }

  const stageSteps = funnel.steps.filter((s) => s.kind === "stage")
  const closedSteps = funnel.steps.filter((s) => s.kind !== "stage")

  const Row = ({ step }: { step: FunnelStep }) => (
    <button
      type="button"
      onClick={() => openDrill(step)}
      disabled={step.count === 0}
      className={cn(
        "grid w-full grid-cols-[minmax(7rem,10rem)_1fr_3.5rem_3.5rem] items-center gap-3 rounded-md px-1 py-1 text-left text-xs",
        step.count > 0 ? "cursor-pointer hover:bg-muted/50" : "cursor-default"
      )}
    >
      <span className="truncate font-medium" title={step.label}>{step.label}</span>
      <span className="h-5 w-full overflow-hidden rounded-sm bg-muted/40">
        <span
          className="block h-full rounded-sm transition-[width] duration-300"
          style={{ width: `${(step.count / max) * 100}%`, backgroundColor: STEP_COLOR[step.kind] }}
          aria-hidden
        />
      </span>
      <span className="text-right font-mono tabular-nums">{n(step.count)}</span>
      <span className="text-right tabular-nums text-muted-foreground">{pctFmt.format(step.pct)}%</span>
    </button>
  )

  return (
    <DashboardCard>
      <ChartCardHeader
        title="Embudo de ventas"
        icon={Filter}
        total={funnel.total}
        actions={
          <ScopePill
            label="Foto de hoy · % del periodo"
            tooltip={
              <>
                Dónde está <strong>hoy</strong> cada oportunidad creada en el periodo. Una barra
                por etapa del embudo <strong>Ventas</strong>, más <strong>Ganadas</strong>{" "}
                (status won o etapa Cierre) y <strong>Perdidas</strong> (Leads Perdidos, o
                lost/abandoned). El porcentaje es sobre el total del periodo, perdidas
                incluidas. El CRM no guarda por qué etapas pasó cada lead, así que esto cuenta
                dónde están, no por dónde pasaron.
              </>
            }
          />
        }
      />
      <ChartCardContent>
        {funnel.total === 0 ? (
          <ChartEmpty message="Sin oportunidades en el periodo seleccionado" />
        ) : (
          <>
            <div className="space-y-0.5">
              {stageSteps.map((s) => <Row key={s.key} step={s} />)}
            </div>
            <div className="mt-3 space-y-0.5 border-t border-border pt-3">
              {closedSteps.map((s) => <Row key={s.key} step={s} />)}
            </div>
            <ChartHint>
              Foto del estado actual: una oportunidad cuenta en la etapa donde está hoy, no en
              las que recorrió. Clic en una barra abre sus oportunidades.
            </ChartHint>
          </>
        )}
      </ChartCardContent>
      <ChartDrillDrawer
        drill={drill}
        onDrillChange={setDrill}
        contacts={allContacts.length > 0 ? allContacts : contacts}
        tasks={tasks}
        calls={calls}
        allOpportunities={allOpportunities}
        allPautas={allPautas}
        appointments={appointments}
        messages={messages}
        locationId={locationId}
      />
    </DashboardCard>
  )
}
```

(`ChartHint` existe en `dashboard-ui.tsx`, línea 314.)

- [ ] **Step 5: Montar**

En `cellarium-dashboard.tsx`, reemplazar el comentario `{/* Task 8 … */}` por `<FunnelChart {...shared} />` con su import.

- [ ] **Step 6: Verificar**

Run: `pnpm verify:funnel && npx tsc --noEmit` y la app.
Expected: con "Todo el historial": Lead Generado ≈ 264, Contactado ≈ 440, Proceso Generado ≈ 48, Follow Up ≈ 8, Meeting/Cita ≈ 10, Ganadas 4, Perdidas 1 091 (las cuentas de etapa bajan en 1-2 donde había lost/abandoned/won dentro de la etapa). La suma de los siete pasos = 1 865.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(embudo): barras por etapa de Ventas con Ganadas y Perdidas, % sobre el periodo

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: "Leads por campaña"

**Files:**
- Create: `lib/campaign-breakdown.ts`
- Create: `scripts/verify-campaign.ts`
- Create: `components/dashboard/campaign-breakdown-chart.tsx`
- Modify: `cellarium-dashboard.tsx`, `package.json`

**Interfaces:**
- Consumes: `campaignOf`, `NO_CAMPAIGN_LABEL`, `statusBucket`, `STATUS_BUCKETS`, `STATUS_LABELS`, `STATUS_COLORS`.
- Produces: `buildCampaignBreakdown(opps): CampaignRow[]` con `CampaignRow = { key; label; missing; total; ganada; abierta; perdida; ids: Record<StatusBucket, string[]> }`.

- [ ] **Step 1: Escribir `scripts/verify-campaign.ts` (falla)**

```ts
// Verification for lib/campaign-breakdown.ts — campaña × estatus.
// Correr: pnpm verify:campaign
// Envuelto en main(): este paquete es CJS.
import assert from "node:assert/strict";
import type { Opportunity } from "../lib/types";
import { LOST_PIPELINE, NO_CAMPAIGN_LABEL, VENTAS_PIPELINE } from "../lib/cellarium-rules";
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
    assert.deepEqual(rows.map((r) => r.label), ["A", "B", NO_CAMPAIGN_LABEL]);
    assert.deepEqual(rows.map((r) => r.missing), [false, false, true]);
    assert.deepEqual(rows.map((r) => r.total), [3, 1, 1]);
    assert.equal(rows[0].ganada, 1);
    assert.equal(rows[0].abierta, 1);
    assert.equal(rows[0].perdida, 1);
    assert.deepEqual(rows[0].ids.ganada.length, 1);
    assert.equal(rows[1].perdida, 1);
  }

  // 2. Empate de volumen: alfabético, y "Sin campaña" sigue al final aunque pese más.
  {
    const rows = buildCampaignBreakdown([opp({ campaignName: "Z" }), opp({ campaignName: "A" }), opp({}), opp({})]);
    assert.deepEqual(rows.map((r) => r.label), ["A", "Z", NO_CAMPAIGN_LABEL]);
  }

  // 3. Vacío.
  assert.deepEqual(buildCampaignBreakdown([]), []);

  console.log("✅ lib/campaign-breakdown.ts — all assertions passed");
}

main();
```

`package.json`: `"verify:campaign": "tsx scripts/verify-campaign.ts",`.

Run: `pnpm verify:campaign` → FAIL, módulo inexistente.

- [ ] **Step 2: Escribir `lib/campaign-breakdown.ts`**

```ts
// Agregación detrás de "Leads por campaña": una fila por campaña de Meta con
// sus oportunidades partidas por estatus. Es la pregunta de dirección —qué
// campaña trae leads que se convierten y cuál trae leads que se pierden— y por
// eso la cubeta es la MISMA de "Oportunidades por estado" (statusBucket), para
// que los totales de las dos tarjetas cuadren.
//
// Puro y sin React para que scripts/verify-campaign.ts lo asevere.
import type { Opportunity } from "./types"
import { campaignOf, NO_CAMPAIGN_LABEL } from "./cellarium-rules"
import { STATUS_BUCKETS, statusBucket, type StatusBucket } from "./opportunity-breakdown"

export interface CampaignRow {
  key: string
  label: string
  /** true en la fila "Sin campaña", que va al final y con la etiqueta en rojizo. */
  missing: boolean
  total: number
  ganada: number
  abierta: number
  perdida: number
  ids: Record<StatusBucket, string[]>
}

function emptyRow(label: string): CampaignRow {
  return {
    key: label,
    label,
    missing: label === NO_CAMPAIGN_LABEL,
    total: 0,
    ganada: 0,
    abierta: 0,
    perdida: 0,
    ids: { ganada: [], abierta: [], perdida: [] },
  }
}

/** Filas por volumen desc (empate alfabético); "Sin campaña" siempre al final. */
export function buildCampaignBreakdown(opps: Opportunity[]): CampaignRow[] {
  const rows = new Map<string, CampaignRow>()
  for (const o of opps) {
    const label = campaignOf(o)
    let row = rows.get(label)
    if (!row) {
      row = emptyRow(label)
      rows.set(label, row)
    }
    const bucket = statusBucket(o)
    row[bucket] += 1
    row.ids[bucket].push(o.id)
    row.total += 1
  }
  return [...rows.values()].sort((a, b) => {
    if (a.missing !== b.missing) return a.missing ? 1 : -1
    return b.total - a.total || a.label.localeCompare(b.label, "es")
  })
}

export { STATUS_BUCKETS }
```

Run: `pnpm verify:campaign` → `✅`.

- [ ] **Step 3: Escribir `components/dashboard/campaign-breakdown-chart.tsx`**

Recharts `BarChart layout="vertical"` con una fila por campaña, apilada por estatus. La leyenda son los tres chips de estatus (mismo patrón que `opportunity-status-chart.tsx`). La altura crece con las filas (`36px` por fila, mínimo 160).

```tsx
"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Megaphone } from "lucide-react"
import type { Appointment, Call, Contact, Message, Opportunity, Pauta, Pipeline, Task } from "@/lib/types"
import { buildCampaignBreakdown, type CampaignRow } from "@/lib/campaign-breakdown"
import { STATUS_BUCKETS, STATUS_LABELS, type StatusBucket } from "@/lib/opportunity-breakdown"
import { PANEL_SCOPES, scopeOpportunities, type PanelId } from "@/lib/panel-scope"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import {
  CHART_GRID_STROKE,
  CHART_TICK,
  ChartCardContent,
  ChartCardHeader,
  ChartEmpty,
  DashboardCard,
  MissingAwareTick,
  NonZeroTooltipContent,
  STATUS_COLORS,
  ScopePill,
} from "./dashboard-ui"
import { ChartDrillDrawer, DRILL_CLOSED, type DrillState } from "./chart-drill-drawer"

const chartConfig = {
  ganada: { label: STATUS_LABELS.ganada, color: STATUS_COLORS.ganada },
  abierta: { label: STATUS_LABELS.abierta, color: STATUS_COLORS.abierta },
  perdida: { label: STATUS_LABELS.perdida, color: STATUS_COLORS.perdida },
}

export interface CampaignBreakdownChartProps {
  panel: PanelId
  opportunities: Opportunity[]
  allOpportunities: Opportunity[]
  contacts: Contact[]
  allContacts: Contact[]
  pipelines?: Pipeline[]
  tasks?: Task[]
  calls?: Call[]
  allPautas?: Pauta[]
  appointments?: Appointment[]
  messages?: Message[]
  locationId?: string
}

/**
 * "Leads por campaña": qué campaña de Meta trajo cuántos leads y en qué
 * terminaron. Barras horizontales por volumen, apiladas por estatus con los
 * mismos colores y la misma cubeta que "Oportunidades por estado".
 */
export function CampaignBreakdownChart({
  panel,
  opportunities,
  allOpportunities,
  contacts,
  allContacts,
  pipelines = [],
  tasks = [],
  calls = [],
  allPautas = [],
  appointments = [],
  messages = [],
  locationId = "",
}: CampaignBreakdownChartProps) {
  const [drill, setDrill] = useState<DrillState>(DRILL_CLOSED)
  const scope = PANEL_SCOPES[panel]

  const rows = useMemo(
    () => buildCampaignBreakdown(scopeOpportunities(opportunities, panel, pipelines)),
    [opportunities, panel, pipelines]
  )
  const total = useMemo(() => rows.reduce((s, r) => s + r.total, 0), [rows])
  const oppById = useMemo(() => new Map(allOpportunities.map((o) => [o.id, o])), [allOpportunities])

  const openDrill = (row: CampaignRow, bucket: StatusBucket) => {
    const items = row.ids[bucket].map((id) => oppById.get(id)).filter((o): o is Opportunity => Boolean(o))
    if (items.length === 0) return
    setDrill({
      open: true,
      title: `${row.label} — ${STATUS_LABELS[bucket]}`,
      subtitle: `Leads por campaña · ${scope.label}`,
      opportunities: items,
    })
  }

  const height = Math.max(160, rows.length * 36 + 24)

  return (
    <DashboardCard>
      <ChartCardHeader
        title="Leads por campaña"
        icon={Megaphone}
        total={total}
        actions={
          <ScopePill
            label="Campaña de Meta · por estatus"
            tooltip={
              <>
                Oportunidades del periodo agrupadas por la <strong>campaña</strong> de Meta
                que las trajo (la primera atribución de la oportunidad), partidas en ganadas,
                abiertas y perdidas con la misma regla que &ldquo;Oportunidades por
                estado&rdquo;. <strong>Sin campaña</strong> junta los leads sin UTM: correo,
                importaciones y captura manual.
              </>
            }
          />
        }
      />
      <ChartCardContent>
        {total === 0 ? (
          <ChartEmpty message="Sin oportunidades en el periodo seleccionado" />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              {STATUS_BUCKETS.map((bucket) => (
                <span key={bucket} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: STATUS_COLORS[bucket] }} aria-hidden />
                  {STATUS_LABELS[bucket]}
                </span>
              ))}
            </div>
            <ChartContainer config={chartConfig} className="w-full" style={{ height }}>
              <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barCategoryGap={8}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={CHART_GRID_STROKE} />
                <XAxis type="number" tick={CHART_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={190}
                  tick={<MissingAwareTick />}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                />
                <ChartTooltip content={<NonZeroTooltipContent />} />
                {STATUS_BUCKETS.map((bucket, i) => (
                  <Bar
                    key={bucket}
                    dataKey={bucket}
                    stackId="campana"
                    fill={STATUS_COLORS[bucket]}
                    radius={i === STATUS_BUCKETS.length - 1 ? [0, 3, 3, 0] : undefined}
                    cursor="pointer"
                    onClick={(payload: { key?: string }) => {
                      const row = rows.find((r) => r.key === payload?.key)
                      if (row) openDrill(row, bucket)
                    }}
                  />
                ))}
              </BarChart>
            </ChartContainer>
          </>
        )}
      </ChartCardContent>
      <ChartDrillDrawer
        drill={drill}
        onDrillChange={setDrill}
        contacts={allContacts.length > 0 ? allContacts : contacts}
        tasks={tasks}
        calls={calls}
        allOpportunities={allOpportunities}
        allPautas={allPautas}
        appointments={appointments}
        messages={messages}
        locationId={locationId}
      />
    </DashboardCard>
  )
}
```

Si `ChartContainer` no acepta `style`, envolverlo en un `<div style={{ height }}>` y darle `className="h-full w-full"`. Las etiquetas largas de campaña ("Cellarium – Leads Industrial Park – A/B Audiencias") se truncan con `width={190}`; si el tick de Recharts no trunca, pasar `tickFormatter={(v: string) => (v.length > 34 ? v.slice(0, 33) + "…" : v)}` al `YAxis` — el nombre completo sigue en el tooltip.

- [ ] **Step 4: Montar**

En `cellarium-dashboard.tsx`, reemplazar la mitad `Task 9` del comentario por `<CampaignBreakdownChart {...shared} />` con su import (deja el `Task 10` para la siguiente tarea).

- [ ] **Step 5: Verificar**

Run: `pnpm verify:campaign && npx tsc --noEmit` y la app.
Expected: 7 filas — 6 campañas + "Sin campaña" (en rojizo, al final); "Cellarium Formulario Junio 25 V1" arriba con ~1 200; suma de filas = 1 865; clic en un segmento abre el drawer.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(campanas): leads por campaña de Meta apilados por estatus

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: "Leads por campaña y mes"

**Files:**
- Create: `components/dashboard/campaign-month-chart.tsx`
- Modify: `cellarium-dashboard.tsx`

**Interfaces:**
- Consumes: `buildMonthSeries` (Task 3), `campaignOf`, `NO_CAMPAIGN_LABEL`, `SERIES_PALETTE`, `SERIES_NEUTRALS`, `MISSING_TEXT`, `MissingAwareTick`, `NonZeroTooltipContent`.
- Produces: `CampaignMonthChart` con la prop surface `shared`.

Colores y plegado se fijan sobre `allOpportunities` (scoped, sin filtro de fechas) para que mover el filtro no repinte las series.

- [ ] **Step 1: Escribir el componente**

```tsx
"use client"

import { useMemo, useState } from "react"
import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from "recharts"
import { CalendarRange } from "lucide-react"
import type { Appointment, Call, Contact, Message, Opportunity, Pauta, Pipeline, Task } from "@/lib/types"
import { campaignOf, NO_CAMPAIGN_LABEL } from "@/lib/cellarium-rules"
import { buildMonthSeries, type SeriesEntry } from "@/lib/month-series"
import { PANEL_SCOPES, scopeOpportunities, type PanelId } from "@/lib/panel-scope"
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import {
  CHART_GRID_STROKE,
  CHART_TICK,
  ChartCardContent,
  ChartCardHeader,
  ChartEmpty,
  DashboardCard,
  MISSING_TEXT,
  MissingAwareTick,
  NonZeroTooltipContent,
  SERIES_NEUTRALS,
  SERIES_PALETTE,
  ScopePill,
} from "./dashboard-ui"
import { ChartDrillDrawer, DRILL_CLOSED, type DrillState } from "./chart-drill-drawer"

const n = (v: number) => v.toLocaleString("es-MX")
const TOTAL_ANCHOR = "__total"
const TOP_RADIUS: [number, number, number, number] = [3, 3, 0, 0]

/** Slot sintético por serie: sirve de dataKey y de nombre de variable CSS. */
function slotOf(entry: SeriesEntry, namedIndex: number): string {
  if (entry.kind === "otros") return "otros"
  if (entry.kind === "empty") return "vacio"
  return `s${namedIndex}`
}
function colorOf(slot: string): { light: string; dark: string } {
  if (slot === "otros") return SERIES_NEUTRALS.otros
  if (slot === "vacio") return SERIES_NEUTRALS.empty
  const i = Number(slot.slice(1))
  return { light: SERIES_PALETTE.light[i], dark: SERIES_PALETTE.dark[i] }
}

export interface CampaignMonthChartProps {
  panel: PanelId
  opportunities: Opportunity[]
  allOpportunities: Opportunity[]
  contacts: Contact[]
  allContacts: Contact[]
  pipelines?: Pipeline[]
  tasks?: Task[]
  calls?: Call[]
  allPautas?: Pauta[]
  appointments?: Appointment[]
  messages?: Message[]
  locationId?: string
}

/**
 * "Leads por campaña y mes": cuándo entró cada campaña. Barras apiladas por mes
 * de creación, una serie por campaña, con la cola larga plegada en "Otros" y
 * "Sin campaña" en gris al final. Series y colores se deciden sobre el set SIN
 * filtrar para que el filtro de fechas no las repinte.
 */
export function CampaignMonthChart({
  panel,
  opportunities,
  allOpportunities,
  contacts,
  allContacts,
  pipelines = [],
  tasks = [],
  calls = [],
  allPautas = [],
  appointments = [],
  messages = [],
  locationId = "",
}: CampaignMonthChartProps) {
  const [drill, setDrill] = useState<DrillState>(DRILL_CLOSED)
  const [isolated, setIsolated] = useState<string | null>(null)
  const scope = PANEL_SCOPES[panel]

  const scoped = useMemo(() => scopeOpportunities(opportunities, panel, pipelines), [opportunities, panel, pipelines])
  const scopedAll = useMemo(() => scopeOpportunities(allOpportunities, panel, pipelines), [allOpportunities, panel, pipelines])

  const dimOpts = useMemo(() => ({ dimensionOf: campaignOf, emptyLabel: NO_CAMPAIGN_LABEL }), [])

  const { slotByKey, namedKeys } = useMemo(() => {
    const all = buildMonthSeries(scopedAll, dimOpts)
    const map = new Map<string, string>()
    const names: string[] = []
    let named = 0
    for (const s of all.series) {
      if (s.kind === "named") names.push(s.key)
      map.set(s.key, slotOf(s, s.kind === "named" ? named++ : 0))
    }
    return { slotByKey: map, namedKeys: names }
  }, [scopedAll, dimOpts])

  const data = useMemo(() => buildMonthSeries(scoped, { ...dimOpts, namedKeys }), [scoped, dimOpts, namedKeys])

  const slots = useMemo(
    () => data.series.map((s) => ({ entry: s, slot: slotByKey.get(s.key) ?? "otros" })),
    [data.series, slotByKey]
  )
  const labelOf = (entry: SeriesEntry) => (entry.kind === "otros" ? `Otros (${entry.foldedCount})` : entry.label)

  const config: ChartConfig = useMemo(() => {
    const out: ChartConfig = {}
    for (const { entry, slot } of slots) out[slot] = { label: labelOf(entry), theme: colorOf(slot) }
    return out
  }, [slots])

  // Filas planas para Recharts: una por mes, un dataKey por slot. Las series sin
  // valor en un mes se dejan AUSENTES, no en cero.
  const rows = useMemo(
    () =>
      data.buckets.map((b) => {
        const row: Record<string, string | number> = { label: b.label, total: b.total, [TOTAL_ANCHOR]: 0 }
        for (const { entry, slot } of slots) {
          const v = b.values[entry.key]
          if (v) row[slot] = v
        }
        return row
      }),
    [data.buckets, slots]
  )
  // El slot más alto de cada fila lleva las esquinas redondeadas.
  const topSlotByRow = useMemo(
    () => rows.map((row) => [...slots].reverse().find(({ slot }) => row[slot])?.slot),
    [rows, slots]
  )

  const oppById = useMemo(() => new Map(allOpportunities.map((o) => [o.id, o])), [allOpportunities])
  const openDrill = (seriesKey: string, rowIndex: number) => {
    const bucket = data.buckets[rowIndex]
    const ids = bucket?.oppIds[seriesKey] ?? []
    const items = ids.map((id) => oppById.get(id)).filter((o): o is Opportunity => Boolean(o))
    if (items.length === 0) return
    const label = data.series.find((s) => s.key === seriesKey)
    setDrill({
      open: true,
      title: `${bucket.label} — ${label ? labelOf(label) : seriesKey}`,
      subtitle: `Leads por campaña y mes · ${scope.label}`,
      opportunities: items,
    })
  }

  const chartId = `campana-mes-${panel}`

  return (
    <DashboardCard>
      <ChartCardHeader
        title="Leads por campaña y mes"
        icon={CalendarRange}
        total={data.grandTotal}
        actions={
          <ScopePill
            label="Por mes de creación"
            tooltip={
              <>
                Oportunidades por el mes en que se crearon, apiladas por la{" "}
                <strong>campaña</strong> de Meta que las trajo. Las cinco campañas mayores
                llevan nombre propio; el resto se pliega en <strong>Otros</strong>. Los
                colores se fijan sobre todo el historial para que el filtro de fechas no los
                cambie. Clic en un nombre de la leyenda lo aísla.
              </>
            }
          />
        }
      />
      <ChartCardContent>
        {data.grandTotal === 0 ? (
          <ChartEmpty message="Sin oportunidades en el periodo seleccionado" />
        ) : (
          <>
            {/* ChartStyle emite --color-<slot> bajo [data-chart=chart-<id>]; la
                leyenda vive FUERA del ChartContainer y necesita el mismo data-chart. */}
            <div data-chart={`chart-${chartId}`} className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
              {slots.map(({ entry, slot }) => {
                const dimmed = isolated !== null && isolated !== slot
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setIsolated(isolated === slot ? null : slot)}
                    className={cn("inline-flex min-w-0 max-w-[14rem] items-center gap-1.5 text-[11px] text-muted-foreground transition-opacity", dimmed && "opacity-40")}
                    title={`${entry.label} · ${n(entry.total)}`}
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: `var(--color-${slot})` }} aria-hidden />
                    <span className={cn("truncate", entry.kind === "empty" && MISSING_TEXT)}>{labelOf(entry)}</span>
                  </button>
                )
              })}
            </div>
            <ChartContainer id={chartId} config={config} className="h-[280px] w-full">
              <BarChart data={rows} margin={{ top: 24, right: 8, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_GRID_STROKE} />
                <XAxis dataKey="label" tick={<MissingAwareTick />} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={12} />
                <YAxis tick={CHART_TICK} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => n(v)} allowDecimals={false} />
                <ChartTooltip
                  content={
                    <NonZeroTooltipContent
                      formatter={(value, name) => (
                        <div className="flex w-full items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: `var(--color-${name})` }} aria-hidden />
                          <span className="flex-1 truncate text-muted-foreground">{config[String(name)]?.label ?? name}</span>
                          <span className="font-mono font-medium tabular-nums text-foreground">{n(Number(value))}</span>
                        </div>
                      )}
                    />
                  }
                />
                {slots.map(({ entry, slot }) => (
                  <Bar key={slot} dataKey={slot} stackId="campana" fill={`var(--color-${slot})`} onClick={(_: unknown, index: number) => openDrill(entry.key, index)} className="cursor-pointer">
                    {rows.map((_, rowIndex) => {
                      const dimmed = isolated !== null && isolated !== slot
                      return <Cell key={rowIndex} fillOpacity={dimmed ? 0.18 : 1} radius={topSlotByRow[rowIndex] === slot ? TOP_RADIUS : undefined} />
                    })}
                  </Bar>
                ))}
                <Bar dataKey={TOTAL_ANCHOR} stackId="campana" fill="transparent">
                  <LabelList dataKey="total" position="top" offset={8} className="fill-muted-foreground" fontSize={10} formatter={(v: number) => n(v)} />
                </Bar>
              </BarChart>
            </ChartContainer>
          </>
        )}
      </ChartCardContent>
      <ChartDrillDrawer
        drill={drill}
        onDrillChange={setDrill}
        contacts={allContacts.length > 0 ? allContacts : contacts}
        tasks={tasks}
        calls={calls}
        allOpportunities={allOpportunities}
        allPautas={allPautas}
        appointments={appointments}
        messages={messages}
        locationId={locationId}
      />
    </DashboardCard>
  )
}
```

Si `NonZeroTooltipContent` no acepta `formatter` o el `Cell` con `radius` tipa mal, copiar la forma exacta que tenía `lost-by-dimension-chart.tsx` en el commit anterior a Task 3 (`git show HEAD~N:components/dashboard/lost-by-dimension-chart.tsx`) — ese archivo compilaba con estas mismas construcciones.

- [ ] **Step 2: Montar**

En `cellarium-dashboard.tsx`, reemplazar el resto del comentario `Task 10` por `<CampaignMonthChart {...shared} />` con su import. Confirmar que no queda ningún comentario `Task N` en el archivo.

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit` y la app.
Expected: eje de jun-2025 a sep-2026, 5 campañas con nombre + "Otros (1)" + "Sin campaña" en gris; totales por barra que coinciden con "Oportunidades por estado" mes a mes (mismo `monthKeyOf`). Cambiar el filtro a "Últimos 3 meses" NO cambia los colores de las series.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(campanas): leads por campaña y mes de creación

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: Asistente, copy y `CLAUDE.md`

**Files:**
- Modify: `lib/ai-context.ts:177-198` (bloque "El negocio")
- Modify: cualquier archivo que el grep del Step 2 señale
- Rewrite: `CLAUDE.md`
- Modify: `.claude/skills/multi-tenancy`, `ai-assistant` (solo si mencionan VAEO/MESH como hechos del negocio)

- [ ] **Step 1: Reemplazar el bloque del negocio en el prompt del asistente**

En `lib/ai-context.ts`, reemplazar desde `# El negocio: Grupo VAEO` hasta el final de la regla `8. **Migración de HubSpot…**` (inclusive, justo antes de `# Reglas críticas`) por:

```
# El negocio: Cellarium

El cliente es **Cellarium World-Class Warehouse**, un desarrollo de **bodegas y lotes industriales** en La Pila, San Luis Potosí, del grupo **Hoganza** (hoganza.com). VENDE (no renta) naves industriales a empresas de logística, distribución y producción. Es una venta larga y de pocas unidades: en 15 meses hay ~1 900 leads y 4 ventas, así que lo que importa es el flujo lead → contactado → proceso → cita → cierre, la calidad del lead por campaña y que las asesoras trabajen lo que tienen.

**El CRM tiene DOS pipelines, y el segundo es la cubeta de perdidas:**

| Pipeline (\`pipelineName\`) | Etapas | Qué es |
|---|---|---|
| \`Ventas\` | Lead Generado → Contactado → Proceso Generado → Follow Up → Meeting/Cita → Cierre | El embudo. |
| \`Leads Perdidos\` | Equivocado, Datos Erróneos, No Contestó 5to contacto, No es la Ciudad Correcta, Falta de presupuesto, Tiempo de entrega, Busca Rentar, Fraude, Busca admin/RH/Otra área, Otro | Las perdidas. **La etapa ES el motivo de pérdida.** |

**Reglas operativas:**
1. **"Perdida" = vive en el pipeline \`Leads Perdidos\`**, aunque su \`status\` diga "open" (la mayoría lo dice: la cuenta pierde MOVIENDO la oportunidad, sin cambiar el status). Para contar perdidas filtra por \`pipeline: "Leads Perdidos"\`, NUNCA por \`status: "lost"\` solo. Las pocas con status lost/abandoned dentro de \`Ventas\` también son perdidas.
2. **"Ganada" = \`status: "won"\` o etapa \`Cierre\`.** Hay muy pocas; no inventes más.
3. **"Abierta" / "en proceso" = en \`Ventas\` y ni ganada ni perdida.** Si el usuario pregunta "cuántas abiertas", NO cuentes las de Leads Perdidos con status open.
4. **Motivo de pérdida = la ETAPA dentro de Leads Perdidos** (\`groupBy: "stage"\` con \`pipeline: "Leads Perdidos"\`). El campo nativo \`lostReason\` solo lo traen las ~40 marcadas lost dentro de Ventas.
5. **Campaña = \`campaignName\`** (el utmCampaign de Meta) en la oportunidad; está poblado en ~98 % de los leads. \`campaign\` trae "creativo / campaña". Los leads sin campaña son correo, importaciones y captura manual.
6. **Asesoras con cartera**: Carla Moreno, Roberto Mendoza, Francisco Maza, Verónica González, María Berrueta. Los demás usuarios son dirección.
7. No hay sucursales ni líneas de negocio: es un solo desarrollo. No hay importación de HubSpot.
8. Los campos de perfil del comprador en el contacto (Presupuesto de Compra, Metraje Buscado, Monto de Enganche, Objetivo de Compra, Tiempo para compra) están casi vacíos (≤ 2 %); solo \`Forma de Pago\` (~58 %) tiene datos. Dilo cuando el usuario pregunte por ellos en vez de reportar un cero como si fuera un hallazgo.
```

Buscar en el resto de `lib/ai-context.ts` y `lib/ai-tools.ts` cualquier mención a VAEO, MESH, sucursal o HubSpot y ajustarla o borrarla (`grep -n -i "vaeo\|mesh\b\|sucursal\|hubspot" lib/ai-context.ts lib/ai-tools.ts app/api/chat/route.ts`).

- [ ] **Step 2: Barrido de copy**

Run: `grep -rn -i "vaeo\|mesh\b\|sucursal\|hubspot\|cliente futuro" app components lib hooks scripts --include='*.ts' --include='*.tsx' | grep -v node_modules`
Expected después de corregir: sin resultados salvo comentarios históricos que expliquen POR QUÉ existe algo (p. ej. la nota de `sync-warning-banner` si la hay). Todo texto visible al usuario o nombre de símbolo que diga VAEO/MESH se cambia. Revisar también `app/layout.tsx` (metadata title) y `app/login`.

Run: `npx tsc --noEmit` y correr todos los verify:

```bash
for s in clients auth limiter attachments paged breakdown lost-matrix advisors filters task-backlog stale-matrix assignment sync-store cellarium month-series funnel campaign; do pnpm -s verify:$s || exit 1; done
```

Expected: 17 `✅`.

- [ ] **Step 3: Reescribir `CLAUDE.md`**

Reemplazar el archivo completo. Conservar textualmente las secciones que no cambian (**Commands** con la lista de verify actualizada, **Environment Variables**, **Repo docs**, **Caché de sincronización**, **Multi-client**, **Loading & progress**, **AI assistant**, **Pauta**, **Key design decisions** sin HubSpot/sucursales, **Internal type system**, **GHL API Gotchas**, **GHL MCP Server**, **UI components** y **Chart conventions**) y reescribir estas:

**Cabecera "The client":**

```markdown
## The client: Cellarium

This repo is a **single-client fork** of the VAEO panel (itself a fork of the shared
multi-client GHL panel), built to serve **one customer: Cellarium**. Nothing here touches
VAEO: own repo (`isaias-lezgo/dashboard_cellarium`), own Vercel project, own Neon DB, own
credentials. The VAEO panel lives in the sibling folder `../DASHBOARDS_VAEO`.

**Cellarium World-Class Warehouse** — industrial warehouse / lot development in La Pila,
San Luis Potosí, by **Hoganza** (`hoganza.com`). It **sells** (never rents) industrial
buildings to logistics, distribution and production companies. Long sales cycle, very few
units: ~1 900 leads and 4 sales in 15 months (measured 2026-09-17). So the panel measures
the **lead-qualification funnel** — lead → contactado → proceso → cita → cierre —, **lead
quality per Meta campaign**, and **whether advisors work what they have**. There is no
money in the CRM (`monetaryValue` unused); do not build revenue charts.

GHL sub-account `hqz4e06E3n5wYIxOoZ6V`, timezone `America/Mexico_City`. Panel reader:
Hoganza's dirección. **One tab**, three blocks: Embudo, Campañas, Sin atención.

**Multi-tenancy is not a design concern here.** The roster code still works — leave it
alone unless asked — but hardcoding Cellarium's pipelines, stages, advisors and fields is
fine and preferred.
```

**Sección "Architecture → Panel scope"** (reemplaza "the pipeline IS the business line"):

```markdown
### Panel scope: two pipelines, and the second one is the lost bucket

| Pipeline | id | Stages |
|---|---|---|
| Ventas | `ImCASVNiiPqszAbyXhmf` | Lead Generado → Contactado → Proceso Generado → Follow Up → Meeting/Cita → Cierre |
| Leads Perdidos | `QaCg8OLw1hiQPs2dhsAA` | **the stages ARE the lost reasons**: Equivocado, Datos Erróneos, No Contestó 5to contacto, No es la Ciudad Correcta, Falta de presupuesto, Tiempo de entrega, Busca Rentar, Fraude, Busca admin/RH/Otra área, Otro |

The panel counts **Ventas ∪ Leads Perdidos** (`lib/panel-scope.ts`, one `PanelId`:
`"cellarium"`). `resolvePipelineId()` returns the **Ventas** id (the funnel — it feeds
`panelStageOrder()`), `resolveLostPipelineId()` the other. Match by **name**, id is fallback.

**`lib/cellarium-rules.ts` is the single source of truth for what this CRM means**, and
nothing re-inlines it:

- **Lost** = `isLostOpp()`: lives in Leads Perdidos (even with `status: open` — 620 of
  1 043 did) OR `status ∈ {lost, abandoned}`. Pipeline wins over a stray `won`.
- **Won** = `isWonOpp()`: `status: won` OR stage matches `WON_STAGE_PATTERN`
  (`/ganad[oa]|\bwon\b|\bcierre\b/i`). Today: 4.
- **Live funnel** = `isLiveOpp()`: neither. This is what "Oportunidades sin atención" scans.
- **Lost reason** = `lostReasonOf()`: the stage inside Leads Perdidos; native `lostReason`
  in Ventas; else `"Sin motivo"`.
- **Campaign** = `campaignOf()`: `opp.campaignName` (= Meta `utmCampaign`, first
  attribution, populated on ~98 % of opps); else `"Sin campaña"`. The `Pautas` custom
  object exists but has **0 records** and the contact's `ID/Nombre/URL Pauta` fields are
  empty — Make never ran here. Attribution is the only real campaign source.
- `statusBucket()` in `opportunity-breakdown.ts` applies lost-then-won, and every chart
  goes through it. `pnpm verify:cellarium` asserts all of this.

Contacts with **no** opportunity are never dropped: `no-opportunity-card.tsx` counts them
against the **raw** `unfilteredOpportunities` set (a filter must not fake orphans) and keeps
them out of every aggregate.
```

**Sección "Current state"** — reescribir como lista de las tarjetas montadas en
`cellarium-dashboard.tsx`, en orden, con una línea cada una y las notas que este plan
dejó: `no-opportunity-card` (raw set), `funnel-chart` (foto de hoy, Cierre no es paso, %
con perdidas en el denominador), `opportunity-status-chart`, `lost-reason-matrix`
(motivo × campaña, una columna por opp), `advisor-stage-table` (Leads Perdidos en una
columna "Perdidas" vía `stageOf`), `assignment-funnel-chart`, `campaign-breakdown-chart`,
`campaign-month-chart` (colores fijados sobre el set sin filtrar, `month-series.ts`),
`stale-opportunity-matrix` + `task-backlog-chart` (conservar íntegras las notas existentes
sobre `lastStageChangeAt`, `STALE_HORIZON_DAYS`, `activityStatus`, `unfilteredOpportunities`
y el epoch en milisegundos, cambiando solo `isLiveStage` → `isLiveOpp`). Decir que
`ExportReportButton` existe pero no está montado.

**Filtros** — reemplazar el bloque "There are three panel-wide filters" por: dos menús
(**Asesor**, **Campaña**) en `lib/panel-filters.ts`, orden
`data.opportunities → applyPanelFilters → scopedOpportunities → filterByDateRange`,
"selección vacía = sin filtro", `ADVISORS` = los cinco con cartera por nombre de pila,
opciones calculadas sobre el set sin filtros de panel, el asistente exento.

**Tabla "Shared domain rules"** — quitar `panel-filters` de sucursal, `category-filter`,
`hubspot-import`, `sales-pivot`, `sales-series`, `lost-cross-matrix`; agregar
`cellarium-rules`, `month-series`, `funnel`, `campaign-breakdown`.

**Commands** — la lista de `verify:*` final es la del Step 2.

Borrar toda mención a MESH, sucursales, HubSpot, "Servicio", Looker, pivot y a los charts
borrados. El `README.md` sigue siendo marketing viejo; mantener la advertencia.

- [ ] **Step 4: Skills del repo**

Run: `grep -rn -i "vaeo\|mesh\b\|sucursal\|hubspot" .claude/skills`
Si `multi-tenancy` o `ai-assistant` describen a VAEO como el negocio, ajustar esa frase a Cellarium; si solo lo usan como ejemplo de mecanismo, dejarlo.

- [ ] **Step 5: Verificación final contra la cuenta real**

Run: `pnpm dev`, "Todo el historial", sin filtros. Anotar y comparar:

| Tarjeta | Esperado (2026-09-17) |
|---|---|
| Header | 2 105 contactos · 1 865 oportunidades · 0 pautas |
| Embudo | suma de pasos = 1 865; Ganadas 4; Perdidas 1 091 |
| Oportunidades por estado | total 1 865; perdidas 1 091; ganadas 4 |
| Motivos de pérdida | grandTotal 1 091; "Equivocado" ≈ 732 (≈ 67 %); 7 columnas |
| Oportunidades por asesor | Carla ≈ 982 arriba; "Sin asesor" 146 al final; columna "Perdidas" |
| Leads por campaña | 7 filas; suma 1 865; "Cellarium Formulario Junio 25 V1" ≈ 1 208 |
| Leads por campaña y mes | totales por mes = los de "Oportunidades por estado" |
| Sin atención | solo abiertas de Ventas (≈ 770 menos won/lost) |

Si un número no cuadra, es un bug de regla: volver a `verify:cellarium` con el caso, no ajustar el chart.

- [ ] **Step 6: Commit y push**

```bash
git add -A
git commit -m "docs: CLAUDE.md y prompt del asistente describen a Cellarium; barrido de copy VAEO/MESH

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
git push
```

---

## Self-review

**Spec coverage.** Reglas de dominio → Task 1 (+ `WON_STAGE_PATTERN`), scope de dos pipelines → Task 2, filtros asesor+campaña → Task 2/3, borrado → Task 3, "Contactos sin oportunidad" → Task 7, embudo → Task 8, estado por mes → Task 1 (regla) + Task 3 (montaje), motivos × campaña → Task 4, asesor × etapa → Task 5, leads sin asesor → Task 3, leads por campaña → Task 9, campaña por mes → Task 10, sin atención → Task 6, asistente y `CLAUDE.md` → Task 11, pruebas → una por tarea + la tabla final. PDF: fuera de alcance (no montado), anotado en desviaciones y en `CLAUDE.md`.

**Placeholders.** Ninguna tarea dice "similar a", "TBD" ni "agregar validación"; cada script de verify y cada módulo trae su código. Las dos indicaciones condicionales ("si `ChartContainer` no acepta `style`", "si `NonZeroTooltipContent` no acepta `formatter`") dan la alternativa concreta.

**Consistencia de tipos.** `statusBucket(opp)` de un argumento en Tasks 1, 4, 8, 9. `buildLostReasonMatrix(opps)` de un argumento en Task 4 (lib, componente, verify). `buildAdvisorMatrix(opps, stageOrder, stageOf?)` en Task 5 (lib, componente, verify). `buildMonthSeries(opps, { dimensionOf, emptyLabel, … })` en Tasks 3 y 10. `resolvePipelineId` = Ventas en Task 2, consumido por `panelStageOrder` (Task 5) y `funnel-chart` (Task 8). `STATUS_COLORS` definido en Task 8 y consumido en Task 9. `campaignOptions` definido en Task 2 y consumido en Task 3. `LOST_STAGE_LABEL` en Task 5 lib, componente y verify.
