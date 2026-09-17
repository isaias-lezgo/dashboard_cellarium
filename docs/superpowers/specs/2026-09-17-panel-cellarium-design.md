# Panel Cellarium: convertir la base de VAEO en el panel de un cliente nuevo

Fecha: 2026-09-17
Estado: diseño aprobado para implementar

## Qué es esto

Este repo nació como copia del panel de Grupo VAEO (`../DASHBOARDS_VAEO`) y sirve a **un
solo cliente nuevo: Cellarium**. Nada de aquí toca VAEO: repo, Vercel, Neon y
credenciales son propios. Este spec describe cómo se convierte la base heredada en el
panel de Cellarium — qué se conserva, qué cambia de regla, qué se construye y qué se
borra.

**Cellarium World-Class Warehouse** es un desarrollo de **bodegas industriales** en La
Pila, San Luis Potosí, del grupo **Hoganza** (`hoganza.com`). Vende (no renta) naves y
lotes industriales a empresas de logística, distribución y producción. La subcuenta de
GHL es `hqz4e06E3n5wYIxOoZ6V`, zona horaria `America/Mexico_City`.

**Quién lo lee**: dirección de Hoganza. **Una sola pestaña** (más "Asistente IA"), con
tres bloques que el cliente pidió con estas palabras: *desglose por campañas, embudo y
oportunidades sin atención*.

---

## Reconocimiento de datos (medido contra `hqz4e06E3n5wYIxOoZ6V`, 2026-09-17)

- **1 865 oportunidades / 2 105 contactos** desde jun-2025, ~100 leads/mes.
- **Dos pipelines, y el segundo es la cubeta de perdidas**:

  | Pipeline | id | Etapas | Opps |
  |---|---|---|---|
  | Ventas | `ImCASVNiiPqszAbyXhmf` | Lead Generado (264) → Contactado (440) → Proceso Generado (48) → Follow Up (8) → Meeting/Cita (10) → Cierre (1) | 822 |
  | Leads Perdidos | `QaCg8OLw1hiQPs2dhsAA` | **las etapas son los motivos**: Equivocado (732), No Contestó 5to contacto (134), Datos Erróneos (47), No es la Ciudad Correcta (44), Otro (36), Falta de presupuesto (24), Busca admin/RH/Otra área (17), Busca Rentar (5), Tiempo de entrega (4) | 1 043 |

- **`status` miente en Leads Perdidos**: 620 de sus 1 043 siguen en `open`. La perdida se
  registra moviendo la oportunidad de pipeline, no cambiando el estatus.
- **Ganadas: 4 con `status: won`** (1 en Contactado, 2 en Proceso Generado, 1 en Cierre —
  la única oportunidad que hay en Cierre). Se acepta la etapa Cierre como señal de venta
  por si algún día cierran sin cambiar el estatus, pero hoy no suma ninguna.
  `monetaryValue` no se usa (2 opps con valor en todo el CRM; las ganadas traen 0).
  **No hay panel de dinero posible ni deseado.**
- **Campaña**: `opp.attributions[]` trae la atribución nativa de Meta en 1 829 de 1 865:
  `utmCampaign` (6 valores — "Cellarium Formulario Junio 25 V1" 1 208, "Cellarium
  Prospectos Formulario Junio 25" 710, "Cellarium – Leads Industrial Park – A/B
  Audiencias" 68, tres de mayo 2025), `utmContent` (creativo), `utmAdId`, `medium`
  (facebook 2 392, whatsapp 449, whatsapp_coex 386, instagram 189, csv_import 70,
  manual 29). **El sync actual tira `utmCampaign`** — solo conserva `utmSource`.
- **El objeto `custom_objects.pautas` existe pero tiene 0 registros**, y los campos
  `ID/Nombre/URL Pauta` del contacto están en 0 de 2 105: el flujo de Make que los llena
  en VAEO nunca corrió aquí. La atribución de Meta es la única fuente real de campaña.
- **No hay custom fields en oportunidades.** Los del contacto que describirían al
  comprador (Presupuesto, Metraje, Enganche, Objetivo, Tiempo para compra) están al
  ≤ 2 %; solo `Forma de Pago` (58 %) y `Primer Mensaje Recibido` (55 %) tienen datos.
  No se construye nada sobre ellos.
- **Asesores** por cartera: Carla Moreno 982, Roberto Mendoza 336, Francisco Maza 232,
  Verónica González Díaz Barreiro 135, María Berrueta Zapata 29; **sin asesor 146**.
  Los otros usuarios (Alejandra Gastelum, Aurelio Cadena, Geovanna Iñiguez, Jorge
  Talancon) no llevan oportunidades.
- `lastStageChangeAt` viene en las 1 865; `lostReasonId` en 40 (todas en Ventas).
- No hay sucursales, no hay segunda línea de negocio, no hay importación de HubSpot.

---

## Decisión de arquitectura: podar y reemplazar reglas

Se evaluaron tres caminos:

- **A. Podar y reemplazar reglas** — conservar el cascarón (auth, sync, caché Neon,
  barra de filtros, drawers, PDF, asistente), borrar lo que no aplica y cambiar las
  reglas de dominio en su sitio para que los charts que sobreviven funcionen sin
  tocarlos. **Elegido.**
- **B. Reconstruir el dashboard desde cero** importando charts uno por uno. Reescribiría
  plumbing que ya funciona (props `all*`, drill-downs, scope) para el mismo resultado.
- **C. Capa de configuración por cliente** para servir a VAEO y Cellarium con el mismo
  código. Es la generalidad que este fork abandonó a propósito. Descartado.

El riesgo de A es dejar restos de VAEO. Se ataja con la lista de borrado explícita de
abajo y reescribiendo `CLAUDE.md` como último paso de la implementación.

---

## 1. Reglas de dominio

Un módulo nuevo, **`lib/cellarium-rules.ts`**, concentra lo que es propio de este CRM,
y tres módulos existentes cambian de regla. Ningún componente re-inlinea nada de esto
— misma disciplina que la sección "Shared domain rules" del `CLAUDE.md`.

### Universo del panel

El panel cuenta las oportunidades de **Ventas ∪ Leads Perdidos**. Una perdida vive en el
segundo pipeline y tiene que seguir contando como lead del mes en que entró; un scope de
un solo pipeline la haría desaparecer del embudo.

`lib/panel-scope.ts` queda con **un solo `PanelId`: `"cellarium"`**, y su scope resuelve
**dos** pipelines por nombre (`Ventas`, `Leads Perdidos`) con fallback a los ids
hardcodeados. El campo `sucursalField` desaparece. `scopeOpportunities()` conserva la
firma para que `app/page.tsx` y los charts no cambien.

### Ganada

`status === "won"` **o** etapa `Cierre`. Se extiende `WON_STAGE_PATTERN` en
`lib/opportunity-status.ts` a `/\bcierre\b|ganad[oa]|\bwon\b/i`. Una oportunidad con
`status ∈ {lost, abandoned}` nunca es ganada, como hoy.

### Perdida

`isLostOpp(opp, pipelines)` en `cellarium-rules.ts`: **vive en Leads Perdidos** (aunque
`status` sea `open`) **o** `status ∈ {lost, abandoned}`. Una perdida nunca es ganada;
si por error una oportunidad en Leads Perdidos trae `status: won`, gana la perdida y se
cuenta una vez — la regla es "pipeline manda".

`statusBucket()` en `lib/opportunity-breakdown.ts` cambia a: ganada si `isWonOpp` y no
`isLostOpp`; perdida si `isLostOpp`; abierta el resto. Como `statusBucket` necesita
saber qué pipeline es Leads Perdidos, recibe el id resuelto (o el arreglo de pipelines)
como segundo argumento; los charts que hoy lo llaman ya reciben `pipelines` en props.

### Motivo de pérdida

`lostReasonOf(opp)`: dentro de Leads Perdidos, **el nombre de la etapa**; para las
perdidas que quedaron en Ventas, el `lostReason` nativo que ya resuelve el sync; si no
hay ninguno, `"Sin motivo"` (centinela, va en `MISSING_TEXT`). `lost-reason-matrix.ts`
deja de leer `opp.lostReason` directo y llama a esta función.

### Embudo vivo

`isLiveOpp(opp)`: en Ventas, no ganada, no perdida. Reemplaza a `isLiveStage()` en
`lib/stale-opportunity-matrix.ts`, que hoy excluye por nombre de etapa
("Ganado"/"Perdido"/"Cliente Futuro"). Las etapas de Ventas son todas vivas; lo que
saca a una oportunidad del embudo vivo es el pipeline o el cierre.

### Campaña

`campaignOf(opp)`: `opp.campaign` (ver sync) o `"Sin campaña"`. La primera atribución
(`isFirst`) manda, igual que hoy `firstAttr()`; una oportunidad con dos atribuciones de
campañas distintas se atribuye a la primera — es la que la trajo.

### Sync: campos nuevos en `Opportunity`

`lib/sync.ts` agrega a la transformación, desde `firstAttr(ghl.attributions)`:

| Campo | Fuente |
|---|---|
| `campaign?: string` | `utmCampaign` |
| `adContent?: string` | `utmContent` |
| `adId?: string` | `utmAdId` |

`lib/types.ts` los declara. Se guardan siempre, aunque el panel solo use `campaign`: el
creativo y el ad id le sirven al asistente y a un drill-down futuro sin volver a tocar
el sync. El caché de Neon se sobrescribe entero en el siguiente refresco, así que un
payload viejo sin estos campos solo dura hasta ese refresco (≤ 15 min) y mientras tanto
todo cae en "Sin campaña"; no hay migración.

### Pautas

El objeto Pautas se sigue leyendo con el código existente (hoy: 0 registros, cero
costo). `isDePauta()` queda como la unión de siempre; en la práctica lo que decide es
`isPaidTraffic` sobre la atribución, que sí tiene datos.

### Asesores

`ADVISORS` en `lib/panel-filters.ts` pasa a los cinco con cartera: Carla, Roberto,
Francisco, Verónica, María. Mismo matching por nombre de pila, sin acentos ni
mayúsculas.

---

## 2. Layout

Una pestaña, **Cellarium** (`DashboardTab = "cellarium" | "conversations"`); la
pestaña "Asistente IA" sigue montada siempre y oculta cuando no está activa.

**Barra global**: fechas, **Asesor**, **Campaña**. Se van *Sucursal* (no existe),
*Origen de lead* y *Canal de contacto* (leen custom fields que aquí no hay) y el toggle
de HubSpot. El menú de campaña reusa `multi-select-filter.tsx` con opciones derivadas
del set cargado, acotadas al rango de fechas, más `Sin campaña` como cubeta. La regla
**"selección vacía = sin filtro"** se conserva. El orden de composición queda
`data.opportunities → applyPanelFilters → scopedOpportunities → filterByDateRange`.

Arriba de todo, **"Contactos sin oportunidad"** (tarjeta existente), fuera de los
agregados.

### Bloque 1 — Embudo

- **`funnel-chart.tsx` (nuevo)** — "Embudo de ventas". Barras horizontales, una por
  etapa de Ventas en orden de pipeline, con conteo y **% respecto al total de leads del
  periodo** (perdidas incluidas en el denominador); debajo, separadas por un espacio,
  dos barras: **Ganadas** y **Perdidas**. Es una foto del hoy sobre los leads creados en
  el periodo: GHL no guarda historial de etapas, así que se cuenta cuántos *están* en
  cada etapa, no cuántos *pasaron*. La tarjeta lo dice en el pie. Cada barra abre el
  drill-down. La agregación vive en `lib/funnel.ts` (etapas en orden del pipeline, no
  alfabético; una etapa sin registros se dibuja en cero, no se omite).
- **"Oportunidades por estado"** (`opportunity-status-chart.tsx`, existe) — ganada /
  abierta / perdida por mes de creación. Correcta con el nuevo `statusBucket` sin tocar
  el chart.
- **"Motivos de pérdida"** (`lost-reason-matrix.tsx`, existe) — motivo × **campaña**.
  El switch local Canal ⇄ Origen desaparece; la columna es siempre la campaña. Las filas
  salen de `lostReasonOf()`.
- **"Oportunidades por asesor"** (`advisor-stage-table.tsx`, existe) — asesor × etapa
  de Ventas, con la barra de estatus por fila. Las perdidas cuentan en la barra, no en
  las columnas de etapa.
- **"Leads sin asesor por mes"** (`assignment-funnel-chart.tsx`, existe).

### Bloque 2 — Campañas

- **`campaign-breakdown-chart.tsx` (nuevo, chico)** — "Leads por campaña". Barras
  apiladas horizontales, una por campaña ordenadas por volumen, series = ganada /
  abierta / perdida con los colores de `STATUS_LABELS`. "Sin campaña" al final, con la
  etiqueta en `MISSING_TEXT`. Drill-down por segmento. Agregación en
  `lib/campaign-breakdown.ts`.
- **"Leads por campaña y mes"** — `lost-by-dimension-chart.tsx` generalizado: barras
  apiladas por mes de creación, series = campaña, con el plegado en "Otros" de
  `lib/sales-series.ts` (cinco tonos máximo, colores fijados sobre el set sin filtrar).
  El toggle "Perdidas ⇄ No ganadas" y el de "Sin servicio" desaparecen; el universo es
  todos los leads del periodo. Si al implementarlo la generalización cuesta más que un
  chart nuevo, se hace uno nuevo y se borra el viejo — lo que no se hace es dejar los
  dos.

### Bloque 3 — Sin atención

- **"Oportunidades sin atención"** (`stale-opportunity-matrix.tsx`) y **"Tareas
  pendientes por asesor"** (`task-backlog-chart.tsx`) entran tal cual, con
  `isLiveOpp()` como único cambio. Siguen ignorando el filtro de fechas y leyendo
  `allOpportunities` / `allTasks` / `unfilteredOpportunities`; `/api/conversation-activity`
  no cambia.

### PDF y asistente

`lib/report.ts` compone el PDF con los charts del panel; se actualiza la lista a los de
arriba. El asistente sigue viendo el dataset completo y sin filtrar; el system prompt se
ajusta en lo mínimo para nombrar a Cellarium y las dos pipelines (la regla "perdida =
Leads Perdidos" tiene que estar ahí o el asistente contará 620 abiertas de más).

---

## 3. Lo que se borra

Con sus scripts `verify:*` y sus entradas en `package.json`:

- `components/dashboard/mesh-dashboard.tsx`; `vaeo-dashboard.tsx` se renombra a
  `cellarium-dashboard.tsx`.
- `sales-pivot-table.tsx`, `sales-by-dimension-chart.tsx`, `lib/sales-pivot.ts`
  (no hay dinero).
- `lost-cross-matrix.tsx`, `lib/lost-cross-matrix.ts` (cruza servicio, que no existe).
- `hubspot-import-toggle.tsx`, `lib/hubspot-import.ts`.
- El filtro de sucursal y su derivación en `app/page.tsx`; `lib/category-filter.ts` y
  los menús de origen/canal.
- Las marcas `/vaeo-mark.png` y cualquier copy con "VAEO" o "MESH" en la UI.

`lib/sales-series.ts` se queda (lo usa el chart por campaña y mes). Los charts
recuperables de git siguen ahí si algún día hacen falta.

---

## 4. Pruebas

- **`pnpm verify:cellarium`** — `lib/cellarium-rules.ts`: perdida en Leads Perdidos con
  `status: open`; perdida en Ventas con `status: lost`; ganada en Cierre con
  `status: open`; ganada con `status: won` en Contactado; `won` dentro de Leads Perdidos
  cuenta como perdida; motivo = etapa en Perdidos, nativo en Ventas, "Sin motivo" sin
  ninguno; `isLiveOpp` excluye Cierre, perdidas y todo Leads Perdidos; `campaignOf` con
  y sin atribución.
- **`pnpm verify:funnel`** — etapas en orden de pipeline, etapa vacía en cero,
  porcentajes con las perdidas en el denominador, ganadas y perdidas fuera de las
  etapas.
- **`pnpm verify:campaign`** — agregado por campaña × estatus, orden por volumen,
  "Sin campaña" al final.
- Sobreviven y se corren: `verify:clients`, `verify:auth`, `verify:limiter`,
  `verify:attachments`, `verify:paged`, `verify:breakdown` (ajustado a la nueva firma de
  `statusBucket`), `verify:lost-matrix`, `verify:advisors`, `verify:assignment`,
  `verify:filters` (sin sucursal), `verify:task-backlog`, `verify:stale-matrix`,
  `verify:sync-store`.
- `npx tsc --noEmit` en verde — `next build` ignora errores de tipos.
- La app corriendo contra la cuenta real, comparando con la radiografía: 1 865
  oportunidades en total, 1 043 + 48 perdidas, 4 ganadas, 146 sin asesor, Equivocado ≈
  70 % de los motivos, "Cellarium Formulario Junio 25 V1" como campaña mayor.

---

## 5. Orden de implementación

1. Reglas de dominio + sync (`cellarium-rules.ts`, `types.ts`, `sync.ts`,
   `opportunity-status.ts`, `opportunity-breakdown.ts`, `panel-scope.ts`) con sus
   verify. Nada visible cambia todavía, pero los charts existentes ya cuentan bien.
2. Borrado (sección 3) y `app/page.tsx` a una pestaña con la barra de filtros nueva.
   La app vuelve a compilar con los charts que sobreviven.
3. Adaptaciones: `lost-reason-matrix` a campaña, `stale-opportunity-matrix` a
   `isLiveOpp`, `ADVISORS`.
4. Charts nuevos: embudo, leads por campaña, campaña por mes.
5. PDF, system prompt del asistente, `CLAUDE.md` reescrito para Cellarium.

Cada paso deja `tsc` y los verify en verde.
