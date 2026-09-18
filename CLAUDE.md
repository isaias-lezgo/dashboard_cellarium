# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## The client: Cellarium

This repo is a **single-client fork** of the VAEO panel (itself a fork of the shared
multi-client GHL panel `dashboards-GHL`), built to serve **one customer: Cellarium**.
Nothing here touches VAEO: own repo (`isaias-lezgo/dashboard_cellarium`), own Vercel
project, own Neon DB, own credentials. The VAEO panel lives in the sibling folder
`../DASHBOARDS_VAEO`; never add a remote, env var or Vercel link pointing at it.

**Cellarium World-Class Warehouse** — industrial warehouse / lot development in La Pila,
San Luis Potosí, by **Hoganza** (`hoganza.com`). It **sells** (never rents — "Busca
Rentar" is a lost reason) industrial buildings to logistics, distribution and production
companies. Long sales cycle, very few units: ~1 900 leads and **4 sales** in 15 months
(measured 2026-09-17). So the panel measures the **lead-qualification funnel** — lead →
contactado → proceso → cita → cierre —, **lead quality per Meta campaign**, and **whether
advisors work what they have**. There is no money in the CRM (`monetaryValue` unused on
all but 2 opps; the won ones carry 0). **Do not build revenue charts.**

GHL sub-account `hqz4e06E3n5wYIxOoZ6V`, timezone `America/Mexico_City`. Panel reader:
Hoganza's dirección. **One tab** ("Cellarium") plus "Asistente IA", in the order
dirección asked for: **KPI strip, Sin atención, Campañas, Embudo, Perdidas**. Design spec:
`docs/superpowers/specs/2026-09-17-panel-cellarium-design.md`; plan under `plans/`.

**Multi-tenancy is not a design concern here.** The roster code (`lib/clients.ts`,
password-as-identity, per-location limiter keying) still exists and still works — leave
it alone unless asked — but do **not** weigh new work against cross-client generality.
Hardcoding Cellarium's pipelines, stages, advisors and fields is fine and preferred.

## Commands

```bash
# Development
pnpm dev        # Start Next.js dev server (localhost:3000)
pnpm build      # Production build (TypeScript errors are ignored — see next.config.mjs)
pnpm start      # Serve production build
pnpm lint       # Run ESLint

# Multi-client
pnpm add-client # Add a client to the DASHBOARD_CLIENTS roster (prompts, validates, prints the blob)
                #   Non-interactive: pnpm add-client --name "X" --location <id> --token pit-…

# Verification (see below — there is no test framework)
pnpm verify:clients      # lib/clients.ts   — roster parsing + password lookup
pnpm verify:auth         # lib/auth.ts      — session token; incl. the cookie-tamper rejection
pnpm verify:limiter      # lib/ghl-limiter.ts — per-location isolation
pnpm verify:attachments  # lib/attachments.ts + lib/attachment-tools.ts — tabular parse/query/join
pnpm verify:paged        # lib/paged-fetch.ts — resiliencia del abanico de páginas
pnpm verify:cellarium    # lib/cellarium-rules.ts — perdida por pipeline, ganada por Cierre, motivo, campaña
pnpm verify:breakdown    # lib/opportunity-breakdown.ts — cubetas de estado por mes
pnpm verify:filters      # lib/panel-filters.ts + lib/panel-scope.ts — asesor, campaña, los dos pipelines
pnpm verify:funnel       # lib/funnel.ts — pasos del embudo, Cierre no es paso, % con perdidas
pnpm verify:campaign     # lib/campaign-breakdown.ts — campaña × estatus
pnpm verify:month-series # lib/month-series.ts — apilado por mes, plegado en "Otros"
pnpm verify:lost-matrix  # lib/lost-reason-matrix.ts — motivo de pérdida × campaña
pnpm verify:advisors     # lib/advisor-breakdown.ts — asesor × etapa + columna "Perdidas"
pnpm verify:assignment   # lib/assignment-funnel.ts — universo sin-asesor vs. denominador del mes
pnpm verify:stale-matrix # lib/stale-opportunity-matrix.ts — cubetas de abandono sobre el embudo vivo
pnpm verify:sync-store   # lib/sync-store.ts — gzip roundtrip, aislamiento por cliente, el candado
npx tsc --noEmit         # REQUIRED: next build ignores TS errors, so a green build proves nothing

# Caché de sincronización (Neon)
pnpm db:migrate          # crea project_sync — idempotente, va por DATABASE_URL_UNPOOLED
```

`pnpm lint` is broken and has been for a while — `eslint` is not actually a dependency of
this repo, so the script exits with `command not found`. `npx tsc --noEmit` is the real
gate.

**No test framework, and not adopting one.** Instead, the pure modules where a silent
bug would be a *cross-tenant data leak* (clients / auth / limiter) or a silently wrong
answer (cellarium-rules / funnel / campaign / opportunity-breakdown / …) have assertion scripts under
`scripts/verify-*.ts` (plain `node:assert/strict`, run via `tsx`). Run them after touching
auth, the roster, the limiter, the attachment parsers, the pagination helpers, or any
of the pure aggregation modules. Everything else is verified by driving the real app.

There is no way to run a single assertion within a script — each `verify:*` script is
the unit. Run the one that covers the module you touched.

Gotcha when writing these scripts: this package is CommonJS (no `"type": "module"`),
so `tsx` compiles to CJS where **top-level `await` fails**. Wrap async work in a
`main()` and call `main().catch(...)` — see the existing scripts.

**Package manager: pnpm.** This repo is managed with pnpm (`packageManager: pnpm@11.x`
in `package.json`), and the Vercel deploy runs `pnpm install --frozen-lockfile` against
`pnpm-lock.yaml`. **Install and add dependencies with `pnpm install` / `pnpm add <pkg>`
— never `npm install`.** Running `npm install` writes `package-lock.json` but leaves
`pnpm-lock.yaml` stale, which makes the Vercel build fail with
`ERR_PNPM_OUTDATED_LOCKFILE`. If a lockfile ever drifts, run `pnpm install
--lockfile-only` to resync only the lockfile (no `node_modules` churn), then commit it.
A tracked `package-lock.json` lingers from before the switch; it is **not** the source
of truth — ignore it.

`pnpm-workspace.yaml` exists only for its `allowBuilds` list (`sharp`, `esbuild`). pnpm 11
blocks postinstall scripts by default; without those entries the install dies with
`ERR_PNPM_IGNORED_BUILDS`. If a new dependency needs a postinstall, add it there.

## Environment Variables

Required vars in `.env.local`:
- `DASHBOARD_CLIENTS` — JSON array of clients, one per GHL sub-account:
  `[{"id","name","locationId","ghlToken","password"?}]`. `password` is optional and
  defaults to that client's `locationId`. Use `pnpm add-client` to extend it safely.
- `DASHBOARD_AUTH_SECRET` — random string used to HMAC-sign the session cookie (`openssl rand -hex 32`)
- `ANTHROPIC_API_KEY` — used by `app/api/chat` (assistant), `analyze-report` (PDF analyses)
  and `analyze-contact`
- `GHL_API_TOKEN` / `GHL_LOCATION_ID` — **not read by the app.** Kept only so the dev
  GHL MCP server (`.mcp.json`) can point at one sub-account.

Optional (the sync cache — see "Caché de sincronización" below):
- `DATABASE_URL` / `DATABASE_URL_UNPOOLED` — injected by the Neon integration on Vercel;
  `vercel env pull .env.local` brings them down locally. **Absent = the app behaves
  exactly as it did before the cache existed**, doing a full GHL sync on every load.

All are server-side only. `DASHBOARD_CLIENTS` is read in `lib/clients.ts`;
`DASHBOARD_AUTH_SECRET` in `lib/auth.ts`, `app/api/auth/login/route.ts`, and
`middleware.ts` — never exposed to the browser.

## Repo docs

- `docs/superpowers/specs/YYYY-MM-DD-<feature>-design.md` — the design doc for a feature;
  `docs/superpowers/plans/` — its implementation plan. Both are written **before** the
  code. When picking up non-trivial work on an existing feature, check for its spec first —
  it usually records why an approach was rejected.
- **`README.md` is stale — do not trust it.** It still describes Next 15, SWR caching, a
  `lib/mock-data.ts` fallback, a `filter-bar.tsx` with member/pipeline/tag filters, and a
  `conversations-dashboard.tsx` tab. None of those exist. This file (CLAUDE.md) is the
  accurate description; treat the README as marketing copy.
- `DESIGN.md` — the design system (named color tokens, typography, component rules).
  `PRODUCT.md` — who the three audiences are and what each asks of the same data.
  `snap.md` / `snap2.md` are one-off Playwright accessibility-tree dumps, not docs.

## Architecture

This is a single-page Next.js 16 (App Router) dashboard that surfaces GoHighLevel CRM
data in two tabs: **Cellarium** and **Asistente IA**. The multi-tenant machinery from the
shared panel is still in place (a client's password resolves to their own GHL sub-account
— see "Multi-client" below), but this deployment serves Cellarium only.

### Panel scope: two pipelines, and the second one is the lost bucket

| Pipeline | id | Stages |
|---|---|---|
| Ventas | `ImCASVNiiPqszAbyXhmf` | Lead Generado → Contactado → Proceso Generado → Follow Up → Meeting/Cita → Cierre |
| Leads Perdidos | `QaCg8OLw1hiQPs2dhsAA` | **the stages ARE the lost reasons**: Equivocado, Datos Erróneos, No Contestó 5to contacto, No es la Ciudad Correcta, Falta de presupuesto, Tiempo de entrega, Busca Rentar, Fraude, Busca admin/RH/Otra área, Otro |

The panel counts **Ventas ∪ Leads Perdidos** (`lib/panel-scope.ts`, one `PanelId`:
`"cellarium"`). A lost lead lives in the second pipeline and must keep counting as a lead
of the month it entered; a single-pipeline scope would make it vanish from the funnel.
`resolvePipelineId()` returns the **Ventas** id (the funnel — it feeds
`panelStageOrder()` and `funnel.ts`), `resolveLostPipelineId()` the other. Match by
**name**, case-insensitive; the id is only a fallback. Charts still take `panel: PanelId`
so nothing had to change in their prop surface.

**`lib/cellarium-rules.ts` is the single source of truth for what this CRM means**, and
nothing re-inlines it (`pnpm verify:cellarium` asserts every rule):

- **Lost** = `isLostOpp()`: lives in Leads Perdidos (even with `status: open` — 620 of
  1 043 did on 2026-09-17; the account loses by MOVING the opp, never by flipping the
  status) OR `status ∈ {lost, abandoned}`. Pipeline wins over a stray `won`.
- **Won** = `isWonOpp()` (`lib/opportunity-status.ts`): `status: won` OR the stage matches
  `WON_STAGE_PATTERN` = `/ganad[oa]|\bwon\b|^\s*cierre\s*$/i`. "Cierre" must be the
  whole stage name — `\bcierre\b` would let "Pre-cierre" win because the hyphen is a word
  boundary. Today: 4.
- **Live funnel** = `isLiveOpp()`: neither. This is what "Oportunidades sin atención"
  scans (it used to be a stage-name blacklist; with the old rule the 620 open-status lost
  opps counted as abandoned work: 1 390 instead of 770).
- **Lost reason** = `lostReasonOf()`: the stage inside Leads Perdidos; the native
  `lostReason` for the ~40 marked lost inside Ventas; else `"Sin motivo"`.
- **Campaign** = `campaignOf()`: `opp.campaignName` (= Meta `utmCampaign` of the FIRST
  attribution — `firstAttr()` in `lib/sync.ts`; only 3 of 1 865 have it in a later
  attribution and not the first), falling back to the contact's
  `attributionSource.campaign` (the contact search never returns `attributions[]`; the
  key there is `campaign`, not `utmCampaign` — the sync reads it, +6 opps). **~39 % have
  no campaign anywhere** (not on the opp, not on the contact, not in tags or the ad
  fields), and instead of one gray blob they land in **four sentinel buckets by how they
  arrived** (`NO_CAMPAIGN_BUCKETS`, order = presentation order): `Sin campaña · Meta
  pagado` (`sessionSource: "Paid Social"` — paid ads Meta stopped passing `utm_campaign`
  for; **since Aug 2026 that is 100 % of incoming leads**, the fix is in the Meta ads /
  lead-form setup, not the CRM), `· Meta orgánico / mensaje directo` (`"Social media"`),
  `· importación / captura manual` (`"CRM UI"` or medium csv_import/manual), `· otro
  origen`. All start with `NO_CAMPAIGN_LABEL` so `isMissingLabel()` tints them and
  `isNoCampaign()` recognizes them; `month-series` takes `emptyLabels[]` and stacks them
  last in that order, and `campaign-month-chart` paints them on a gray ramp (darkest =
  paid, the one that matters). `opp.sessionSource` is the raw `utmSessionSource`, kept by
  the sync for this. The `Pautas` custom object exists but has **0 records** and the
  contact's `ID/Nombre/URL Pauta` fields are empty — the Make flow never ran here.
- `statusBucket()` in `opportunity-breakdown.ts` applies lost-then-won and every chart
  goes through it, so all cards agree on 1 091 lost / 4 won / 770 open.

Contacts with **no** opportunity are never dropped: the "Contactos sin oportunidad" card
in `kpi-strip.tsx` counts them against the **raw** `unfilteredOpportunities` set (a panel
filter must not fake orphans) and keeps them out of every aggregate. 252 today (12 %).

### Current state

`components/dashboard/cellarium-dashboard.tsx` builds one `shared` object and spreads it
into every per-opportunity chart; keep that pattern. Its prop surface is the one
`app/page.tsx` already feeds (date-filtered slices + unfiltered `all*` lookup sets +
`unfilteredOpportunities` + `allTasks` + the conversation-activity trio), so a new chart
drops in with no plumbing. Mounted, in order:

- **`kpi-strip.tsx`** — six `KpiCard`s in one row, each with a drill-down: Leads del
  periodo, Abiertas, Ganadas, Perdidas, Sin asesor (all from `statusBucket` over the scoped
  slice, so they agree with every chart below) and Contactos sin oportunidad (see above).
- **Sin atención** (right under the strip, by request) — `stale-opportunity-matrix.tsx`,
  unchanged except the universe is `isLiveOpp()`. It ignores the global date filter ("sin
  atención en 60 días" is a condition of TODAY), reading `allOpportunities` instead of the
  filtered slice; it does respect asesor and campaña because those come applied upstream.
  Measured 2026-09-18: 650 of 770 open opps sit in the +60 d / +60 d cell. Keep the
  following, they are hard-won:
  - `unfilteredOpportunities` (the raw `data.opportunities`) is NOT redundant with
    `allOpportunities`: the latter already went through the panel menus. The KPI strip
    uses it to tell a contact with NO opportunity from one whose opportunity was filtered
    out. Don't merge them.
  - The message axis of the matrix does NOT come from the `dashboard-messages` dataset
    (that route brings the last 30 conversations PER USER, a sample). It comes from
    `app/api/conversation-activity`, which walks `/conversations/search` by cursor up to
    `STALE_HORIZON_DAYS` and only opens threads whose last message is inbound.
  - **`/conversations/search` returns `lastMessageDate` as epoch MILLISECONDS**, not the
    ISO the type declares. The route normalizes it with `toIso()` at the boundary; don't
    remove that — the same epoch as a string would be Invalid Date and send everyone to
    the abandonment bucket.
  - **`STALE_HORIZON_DAYS` (60) couples the route to the buckets.** Add a 90-day bucket →
    raise it, or 60–90-day conversations never arrive and the chart lies.
  - **The matrix does not render until `activityStatus === "ready"`.** With an empty map
    every opp falls in "+60 d" and the chart claims total abandonment: alarming,
    plausible, false. `loading` paints a skeleton, `error` an explicit retry state.
  - **Movement is `lastStageChangeAt`, never `updatedAt`.** Make flows and a WhatsApp bot
    push `updatedAt` on every automatic write.
- **Campañas**
  - **`campaign-breakdown-chart.tsx`** ("Leads por campaña", `lib/campaign-breakdown.ts`)
    — horizontal bars, one per campaign by volume, stacked by `statusBucket`; "Sin campaña"
    last, label in `MISSING_TEXT`. Y-axis labels are truncated with `tickFormatter`
    (`MissingAwareTick` now honors it and detects the sentinel on the RAW value).
  - **`campaign-month-chart.tsx`** ("Leads por campaña y mes", `lib/month-series.ts`) —
    stacked by creation month, series = campaign, fold into "Otros" past **five** named
    series — `buildMonthSeries` folds strictly above `maxNamed` (the old "exactly
    maxNamed+1 doesn't fold" rule left a sixth series with no color: the palette has five
    tones). Series/colors are fixed on the **unfiltered** scoped set so the date filter
    never repaints them. Legend chips live outside the `ChartContainer` and carry the same
    `data-chart` so the `--color-<slot>` vars resolve. `monthKeyOf` is the local-time one
    from `opportunity-breakdown`, same as the status chart, so a lead lands in the same
    month in both cards.
- **Embudo**
  - **`funnel-chart.tsx`** ("Embudo de ventas", `lib/funnel.ts`) — CSS bars, one per Ventas
    stage in pipeline order, then Ganadas and Perdidas. It is a **photo of today**: GHL
    keeps no stage history, so it counts where each lead *is*, not what it passed through;
    the card says so. The **Cierre stage is not a step** (its opps are the won ones). `%`
    is over the whole period **with lost in the denominator** — "2 % reached Meeting" only
    means something next to the 58 % that was lost. Empty stages render at zero.
  - **`opportunity-status-chart.tsx`** — ganada / abierta / perdida by creation month.
  - **`advisor-stage-table.tsx`** — asesor × Ventas stage. Opps in Leads Perdidos go to
    **one** `LOST_STAGE_LABEL` column ("Perdidas") via the `stageOf` option of
    `buildAdvisorMatrix`, instead of ten reason columns. Column shading is per column;
    "Sin asesor" is excluded from it. A deleted GHL user shows up as a raw id row
    (`njTYv85ArMkSNHL14Fh6`, 1 opp) — CRM data, not a bug.
  - **`assignment-funnel-chart.tsx`** ("Leads sin asesor por mes") — universe is
    **only** opps without `assignedTo` (146 today), stacked by status; assigned ones only
    feed `monthTotal`, the "% del mes" denominator. Legend lists only buckets with data.
- **Perdidas** (last, by request)
  - **`lost-reason-matrix.tsx`** ("Motivos de pérdida", `lib/lost-reason-matrix.ts`) —
    motivo × **campaña**; one column per opp so a row's horizontal sum is its total. Rows
    group spellings under `categoryKey`. Today "Equivocado" is 732 of 1 091 (67 %), and
    "Cellarium Formulario Junio 25 V1" alone contributes 294 of them with zero "No
    contestó" — a form-quality finding, not a bug.

**Not mounted**: `export-report-button.tsx` (PDF export) exists and compiles but no
dashboard mounts it; `opportunity-win-rate-chart.tsx` and `task-backlog-chart.tsx` (with
`lib/task-backlog.ts`) were deleted — the first because 4 wins in 15 months makes a win
rate noise, the second because dirección asked for it to go. `PANEL_TIME_ZONE` moved to
`lib/cellarium-rules.ts`. Charts the VAEO panel had (sales pivot, sales by sucursal /
servicio, lost by servicio, lost cross matrix, origen/canal rankings, HubSpot toggle) are
recoverable from git history — check there before rebuilding one from scratch.

**`ChartContainer` (`components/ui/chart.tsx`) already wraps its child in a Recharts
`ResponsiveContainer`.** Do not nest another one inside it. It also spreads extra props
to its div, so `style={{ height }}` works for charts whose height depends on row count.

The third tab (`DashboardTab` id `"conversations"`, labelled **"Asistente IA"**) renders
`conversations-chat.tsx`. It is **permanently mounted and merely hidden** when inactive,
so the chat history survives tab switches — do not make it conditional. It always sees
the full, unfiltered dataset.

### Data flow

```
browser → middleware.ts (verifies the signed dash_session cookie)
    ↓
app/api/dashboard/route.ts
    ↓  requireClient()  → resolves the cookie's client id to a ClientConfig (lib/session.ts)
    ↓  readSync(client)  → lib/sync-store.ts → Neon
    ├─ HAY caché y no viene ?fresh=1 → manda UN frame `data` y termina (0.8-2.4 s).
    │    Si pasó de 15 min, after(() => refreshInBackground()) corre el sync
    │    DESPUÉS de que la respuesta salió; el usuario nunca lo espera.
    └─ NO hay caché (o ?fresh=1, o Postgres no responde) → sync en vivo ↓
    ↓  lib/sync.ts  syncProject(client, send?)  ← la MISMA función en ambos caminos
    ↓  withClient(...)  → establishes the per-request credential context (lib/ghl-context.ts)
    ↓
lib/ghl-client.ts  (raw GHL types + fetch helpers; reads token+location from the context)
    ↓  lib/ghl-limiter.ts  (concurrency + rate limiting, keyed PER LOCATION)
GHL REST API (services.leadconnectorhq.com)
    ↓  back up: transforms GHL → internal types; contacts/opps/pautas/appointments/tasks fetched concurrently
    ↓  NDJSON stream of {progress|location|step|data|error} frames
hooks/fetch-stream.ts  (parses the NDJSON stream)
    ↓
hooks/use-dashboard-data.ts  (custom streaming fetcher; exposes data, progress text, and structured per-dataset `steps`. No SWR/caching — refresh() re-runs the full sync)
    ↓
app/page.tsx  (tab state, date-filter state, applies the client-side date-range filter, renders dashboard)
    ↓
components/dashboard/cellarium-dashboard.tsx
```

Beyond that main sync, the app has other routes under `app/api/`. **Every one that touches
GHL must run through `requireClient()` + `withClient()`**; the ones that work off data the
browser already holds (`chat`, `analyze-report`, `attachments/process`) need only the
middleware gate.

### Caché de sincronización (Neon Postgres)

Un sync completo contra GHL tarda decenas de segundos; con el caché la carga normal baja
a un par. La ruta lee una fila de `project_sync` con el payload ya armado, la manda, y
**si el dato pasó de 15 min dispara el refresco DESPUÉS de responder** (`after()` de
`next/server`). El usuario nunca espera al refresco.

- **`lib/db.ts`** es lo único que sabe que la base es Neon. `getSql()` es perezoso a
  propósito: importar el módulo sin `DATABASE_URL` — un verify script, un paso de build —
  no debe tronar, y `neon()` truena con una URL vacía.
- **`lib/sync-store.ts`** — `readSync` / `writeSync` / `claimSync` / `releaseSync` /
  `isStale`. Una tabla, `bytea` + gzip (nunca consultamos dentro del payload, lo mandamos
  entero). El caché es **desechable**: se sobrescribe entero, guarda solo el presente, y
  si se borra la tabla se rellena sola. Esa propiedad es lo que lo mantiene en una tabla
  en vez de un esquema y lo que evita acumular datos personales históricos. **No guardes
  historia aquí.**
- **`lib/sync.ts`** — `syncProject(client, send?)`. La orquestación salió del route
  handler precisamente para que la ruta y el refresco en segundo plano llamen al mismo
  código; dos copias se desincronizan al primer cambio. `send` es opcional porque el
  refresco no tiene a quién mandarle progreso, y `withClient()` se entra **dentro** de
  `syncProject`, no alrededor del handler: el stream sigue produciendo frames después de
  que `GET()` regresó.
- **Todas las funciones del store reciben el `ClientConfig`, nunca un string.** Leer la
  fila equivocada renderizaría el panel de A con datos de B — la misma clase de fuga que
  `lib/ghl-context.ts` existe para evitar.
- **`claimSync` decide dentro del `WHERE` del UPDATE**, no en TypeScript: un
  read-then-write dejaría una ventana donde dos peticiones ven el candado libre y ambas
  sincronizan. El candado se auto-sana a los 10 min. `releaseSync` **no toca el payload**
  — un refresco fallido debe dejar el último caché bueno donde estaba.
- **`synced_at` sale del payload (`meta.fetchedAt`), no de `now()`**: registra cuándo se
  trajo el dato de GHL, que es lo que significa el "Actualizado hace X" del header.
- **La base NO es una dependencia.** Todo fallo de Postgres se registra y cae al sync en
  vivo (`readCache` / `saveQuietly` en la ruta). Meter el caché no puede crear una forma
  nueva de que el panel no cargue. Se prueba apuntando `DATABASE_URL` a un host inválido
  y confirmando que la app sigue funcionando.
- **`maxDuration = 300` necesita Fluid Compute encendido** (Settings → Functions). Eso es
  lo que sube el techo, no el plan. Sin Fluid el techo es 60 s y un refresco cortado a la
  mitad falla **en silencio**, porque corre después de que la respuesta salió; el síntoma
  es que el "Actualizado hace X" deja de avanzar.
- El botón **Actualizar** manda `?fresh=1` (`refresh()` en `use-dashboard-data.ts` va en
  fresco por defecto); el montaje inicial no, que es el punto de todo esto.
- **No caches las rutas de detalle** que se piden al abrir un drawer, ni
  `/api/conversation-activity`. Van a GHL en vivo y ahí está bien.

### Multi-client (multi-tenancy)

One deployment serves every client. **The password IS the client's identity.** The full
mechanism (roster seam, signed cookie, `requireClient()`, the `withClient()`
AsyncLocalStorage context, per-location limiter keying) is in the **`multi-tenancy`
skill** — load it before touching `lib/clients.ts`, `lib/auth.ts`, `lib/session.ts`,
`lib/ghl-context.ts`, `lib/ghl-limiter.ts` or `app/api/auth/*`. The two prohibitions below
stay here because they must never be out of context:

**NEVER** replace the AsyncLocalStorage context with a module-level "current client"
variable: one serverless instance serves overlapping requests, so that would
silently serve client A's dashboard using client B's token.

**Password model — a deliberate, informed tradeoff. Do not "fix" it unprompted.**
A client's password defaults to their GHL `locationId`. That id is *not* a secret
(it appears in GHL URLs, embed codes, webhook payloads, Make scenarios) and it
**cannot be rotated**. The owner accepted this knowingly, for the convenience of
having nothing extra to manage. The escape hatch is already built in: the optional
`password` field on a client entry overrides the default, so any single client can be
given a real, rotatable password by adding one line — no migration, no code change.
Suggest that if a password leaks; don't rewrite the model on your own initiative.

### Loading & progress

The dashboard fetch streams NDJSON progress frames rather than returning a single JSON blob, so the UI can show live progress during the multi-second GHL sync:
- `{ type: "location", name }` — sub-account name (resolved first, for the loading header).
- `{ type: "step", key, status, count }` — structured per-dataset progress. `key` ∈
  `config | contacts | opportunities | pautas | appointments | tasks`; `status` ∈
  `loading | retrying | done | partial | error`. `partial` means the dataset came back
  known-incomplete (some pages never landed) and `error` means it came back with nothing
  — neither is the same as a legitimate zero, which is `done` with `count: 0`. The `data`
  frame carries a matching `warnings[]` that drives the dashboard's amber banner
  (`components/dashboard/sync-warning-banner.tsx`). Because those datasets are fetched
  **concurrently**, the loading screen (`components/dashboard/loading-screen.tsx`) renders
  one live row per dataset with a running count, plus a determinate progress bar driven by
  completed-step count.
- `{ type: "progress", message }` — human-readable fallback text.
- `{ type: "data", ... }` / `{ type: "error", ... }` — terminal frames.

**`loading-screen.tsx` tiene DOS caras, y el interruptor es `liveSync`** (derivado en
`use-dashboard-data.ts`). El caché cambió lo que significa "cargando":

- **`CacheFace`** — el camino caliente. El payload viene de Postgres, llega un único
  frame `data` y no hay nada que reportar: anillo, título y una barra indeterminada.
  Sin filas, sin barra determinada, sin `0%`, sin cronómetro, sin la píldora de
  subcuenta (en caché tampoco llega frame `location`). Antes se pintaban las seis filas
  congeladas en gris al 0% por uno o dos segundos, lo que leía como app trabada — **un
  porcentaje que nunca se mueve es peor que ningún porcentaje.**
- **`SyncFace`** — el camino frío. Es la pantalla detallada de siempre, intacta. Aquí el
  sync tarda del orden de minuto y medio y el detalle por dataset sí se gana su lugar.

**La señal es la llegada de un frame `step`, y SOLO esa.** `progress` y `locationName`
no sirven: `load()` fija el primero en el cliente antes de que la red conteste, y el
segundo sobrevive de la carga anterior, así que ambos estarían encendidos en los dos
caminos. Los `step` solo salen del servidor y el camino caliente no emite ninguno.

Ojo con dónde se ve cada una: `app/page.tsx` monta la pantalla solo con
`isInitialLoad = isLoading && !data`, así que **el botón "Actualizar" nunca la muestra**
— deja el panel puesto y reporta el progreso en el header. `SyncFace` aparece en la
primera carga de la sesión cuando no hay fila en caché, o cuando Postgres no responde.

### AI assistant

The assistant is an **agent loop that runs in the browser**, not on the server:
`app/api/chat/route.ts` handles one Anthropic turn per request and holds no session
state; `hooks/use-agent-loop.ts` executes the ~25 tools locally and POSTs back
`tool_result` blocks. Users can also drop PDF / CSV / Excel files into the composer.
Full details — tool inventory, the Spanish system prompt's regression rules, prompt
caching, timezone handling, and the attachment pipeline — are in the **`ai-assistant`
skill**. Load it before touching `app/api/chat`, `hooks/use-agent-loop.ts`,
`lib/ai-*.ts`, `lib/conversations-panel.ts`, `lib/attachments.ts` or
`app/api/attachments/process`.

### Shared domain rules (single sources of truth)

A handful of small `lib/` modules exist so every chart and the AI tools agree on the
same definitions. **Never re-inline any of this logic in a component** — a local copy
that drifts makes two cards report different numbers for the same question, which is the
bug class these modules were extracted to kill.

| Module | Owns |
|---|---|
| `lib/cellarium-rules.ts` | **perdida / viva / motivo / campaña**, the two pipeline refs, the sentinels (see "Panel scope") |
| `lib/opportunity-status.ts` | `isWonOpp()` + `WON_STAGE_PATTERN` — canonical "won" detection |
| `lib/panel-scope.ts` | which two pipelines the panel means; `resolvePipelineId` = Ventas, `resolveLostPipelineId` |
| `lib/panel-filters.ts` | los dos filtros globales de la barra (asesor, campaña) y `ADVISORS` |
| `lib/opportunity-breakdown.ts` | `statusBucket()` (lost-then-won), won/open/lost per month, `monthKeyOf` (local time), `categoryKey` / `mostFrequent` |
| `lib/funnel.ts` | los pasos del embudo |
| `lib/campaign-breakdown.ts` | campaña × estatus |
| `lib/month-series.ts` | el apilado por mes × dimensión (getter) con el plegado en "Otros"; `dimensionOf` is a function, not a field name |
| `lib/lost-reason-matrix.ts` | motivo de pérdida × campaña |
| `lib/advisor-breakdown.ts` | la matriz asesor × etapa (+ `stageOf`, `LOST_STAGE_LABEL`) y `panelStageOrder` |
| `lib/assignment-funnel.ts` | el universo de las oportunidades sin asesor, por mes y por estatus |
| `lib/stale-opportunity-matrix.ts` | las cubetas de abandono en los dos ejes sobre `isLiveOpp` |
| `lib/pauta.ts` | what counts as "de pauta" + campaign-name resolution (below) |
| `lib/source-platform.ts` | "Origen de lead" platform bucketing + `PLATFORM_COLORS` / `PLATFORM_ORDER` |
| `lib/csv.ts` | CSV cell escaping (`csvCell`, `buildCsv`) |

- **`isWonOpp()`**: some sub-accounts never flip `status` to `"won"` — they record a sale
  by moving the opportunity into a late stage ("09. Negocio Ganado") while `status`
  stays `"open"`. Detection matches the **stage name** (`/ganad[oa]|\bwon\b/i`), never
  hardcoded stage IDs, so it stays portable across locations. An explicitly
  `lost`/`abandoned` opp is never a win regardless of stage.
- **`source-platform.ts`**: buckets into Instagram / Facebook / TikTok / Google / Otro by
  loose substring match, because field *names* differ per sub-account ("Origen de Lead"
  vs "Origen del Lead", "Tipo de pauta" vs "Tipo de anuncio"). **WhatsApp is deliberately
  absent** — it's a contact channel, not a lead origin, so a bare "whatsapp" stays in
  "Otro". `components/dashboard/origen-de-lead-criteria.tsx` is the UI that explains these
  rules to the user; keep the two in sync.
- **`csv.ts`**: shared by the assistant's `export_csv` tool and the drill drawer's
  "Exportar" button (`lib/drill-export.ts`), so both files escape identically.
  `lib/download.ts` triggers the actual browser download for both.

#### Pauta (paid-advertising) classification

`lib/pauta.ts` is the **single source of truth** for what counts as "de pauta", used by
the AI tools (no chart in this panel uses it today — Cellarium's Pautas object is empty,
see "Panel scope"). Do not re-inline this logic anywhere.

- `isDePauta(opp, pautaContacts)` — a deliberate **union**: the contact is linked to a
  Pauta custom-object record **OR** the opportunity itself carries a paid-traffic
  source/medium (`isPaidTraffic`). Neither signal alone is complete — Pauta records come
  from a Make scenario and don't always exist, and not every paid lead keeps its UTM — so
  each covers the other's gaps.
- `resolveCampaignName()` — an ordered fallback chain, since sub-accounts name the field
  differently ("Nombre pauta", "Nombre de la pauta", …) and some accounts have no
  attribution URL at all.
- Totals legitimately differ between grouping modes; that's by design, not a bug.

### PDF report export

`components/dashboard/export-report-button.tsx` and `lib/report.ts` exist but **no
dashboard mounts the button** in this fork. The same `create_pdf` spec/renderer backs the
AI assistant's PDF tool, so changing `lib/pdf/*` affects it. **Brand rule**:
`sanitizeBrand()` strips "GoHighLevel"/"GHL" from all rendered text — the platform is
presented as "Lezgo Suite CRM", and the AI prompts carry the same rule. Everything else is
in the **`pdf-report`** skill.

### Key design decisions

- **No mock-data fallback**: when the GHL API is unavailable or errors, the UI renders against empty arrays (`data?.contacts ?? []` patterns in `app/page.tsx`). The former `lib/mock-data.ts` and its stand-ins have been removed.
- **All GHL API calls are server-only**: `lib/ghl-client.ts` is never imported from client components — only from API routes. This keeps the token out of the browser bundle. Client code reaches GHL data through `lib/ghl-fetchers.ts`, which calls those routes.
- **`/opportunities/search` uses `location_id` (snake_case)** while most other endpoints use `locationId` (camelCase). The `useSnakeCaseLocationId` flag in `ghlFetch` handles this quirk.
- **Filtering is entirely client-side**: `lib/date-range.ts` (`DateFilter`, `resolveDateRange`, `filterByDateRange`) filters the already-fetched dataset by date; `components/dashboard/date-range-filter.tsx` is the UI *and* the bar that hosts every other panel-wide filter. The filtered slices are computed in `app/page.tsx` and passed to each dashboard as props. The filter bar is hidden on the AI assistant tab, which always sees the full dataset.
- **Two panel-wide filters, and they compose in a fixed order** — both live in
  `app/page.tsx` and are applied to the opportunity set **before** the date cut, so the
  date-filtered slices and the unfiltered `all*` lookup sets agree. A drill-down must never
  surface a record the charts excluded:
  `data.opportunities` → `applyPanelFilters` → `scopedOpportunities` → `filterByDateRange` → `opportunities`.
  **`lib/panel-filters.ts`** owns two menus: **Asesor** and **Campaña**
  (`multi-select-filter.tsx`, one generic component mounted twice). Notes worth keeping:
  - **Empty selection = no filter.** Do not "fix" this into an all-selected neutral state:
    with that convention a campaign newly launched in Meta would silently sit outside a
    filter the user believes is off.
  - `ADVISORS` is **hardcoded to the five users with a portfolio** (Carla Moreno, Roberto
    Mendoza, Francisco Maza, Verónica González, María Berrueta — the other four are
    dirección). Matching is by **first name**, accent- and case-insensitive against
    `opp.assignedTo`, so a corrected surname in GHL doesn't break the filter.
  - Campaign options (`campaignOptions`) are computed on the set **without** the panel
    filters applied (otherwise picking one campaign would empty the menu), sorted by
    volume, with `Sin campaña` last and muted so those records stay reachable.
  - They filter **opportunities only** — contacts carry no campaign of their own.
  - The AI assistant is exempt, same as the date filter.
- **`calls` is always empty** in live data — GHL doesn't expose a public calls endpoint in the standard API. **`tasks` is populated** via the location-wide `/locations/:id/tasks/search` endpoint (`searchLocationTasks`), fetched concurrently with the other datasets.
- **Drill-downs resolve joins against the *unfiltered* set.** Dashboards take both
  `opportunities` (date-filtered, for display) and `allOpportunities` (everything, as a
  lookup table) — likewise `allContacts` / `allPautas` / `allAppointments`. An opportunity
  can be created outside the window that puts its contact on screen, so joining against the
  filtered slice silently drops real rows. Keep that pairing when adding a drawer.

### Internal type system

`lib/types.ts` defines the canonical internal types; the API route transforms raw GHL shapes into these before returning JSON. Always work against the internal types in components — **never import from `lib/ghl-client.ts` on the client side.**

## GHL API Gotchas

The REST API has enough sharp edges (customFields differing between read and write, DATE
fields arriving as epoch-ms at UTC midnight, snake_case on `/opportunities/search`, tag
writes overwriting the whole list) that they live in the **`ghl-api` skill**. Load it
before touching `lib/ghl-client.ts`, `app/api/dashboard/route.ts`, `lib/ghl-fetchers.ts`,
or any code that reads or writes GHL data.

## GHL MCP Server

An HTTP MCP server (`ghl-mcp`, configured in `.mcp.json`) connects directly to GoHighLevel's hosted MCP endpoint (`https://services.leadconnectorhq.com/mcp/`). It authenticates with the same `GHL_API_TOKEN` and `GHL_LOCATION_ID` env vars used by `lib/ghl-client.ts`.

- **Purpose**: lets Claude Code query/mutate live GHL data directly during development (inspecting real contacts, opportunities, pipelines, custom fields, conversations) without writing throwaway scripts. It is **not** part of the app's runtime data flow — the app always goes through `app/api/dashboard/route.ts` → `lib/ghl-client.ts`. Never wire MCP calls into application code.
- **Use it to**: verify real data shapes, discover pipeline/custom-field IDs, confirm API behavior, and validate transforms against production data before coding them in `route.ts`.
- **Caution**: its tools are prefixed `mcp__ghl-mcp__`, and the write ones (create/update/upsert/send/post) mutate live production data. Default to read-only tools; only use write tools when explicitly asked.

### UI components

- `components/ui/` — shadcn/ui components (generated, **do not hand-edit**)
- Shared chart chrome lives in `dashboard-ui.tsx`: `ChartCardHeader`, `ScopePill` (scope
  label + tooltip explaining a chart's rule), and `CardTone` (won/lost card tints — the
  light/dark pairs are tuned by eye, not numerically matched; don't "normalize" them)
- **Toda cubeta centinela va en el rojizo de `MISSING_TEXT`** (`dashboard-ui.tsx`, token
  `--missing`): "Sin fecha", "Sin campaña", "Sin motivo", "Sin asesor", "Sin dato", y
  el "Sin datos de contacto" del drawer. No son una categoría del negocio
  sino un hueco de captura en GHL, y el gris de antes las hacía leer como una fila más.
  Tres reglas: (1) tiñe **solo la etiqueta** — la barra, el sombreado y el segmento
  apilado siguen en gris, porque ahí el color codifica datos y el rojo rompería la
  validación de `SERIES_NEUTRALS`; (2) en un eje de Recharts se usa `MissingAwareTick`,
  que detecta la cubeta por texto (`isMissingLabel`) porque el tick llega sin la bandera
  que sí traen las filas de las tablas; (3) un **estado vacío** ("Sin oportunidades en el
  periodo") NO lo usa — es un resultado legítimamente vacío, no un dato faltante.

**Chart conventions** — apply to every new chart:
- Use `NonZeroTooltipContent` so empty series don't render noise, and wire a drill-down
  drawer (`chart-drill-drawer.tsx`) — every chart should be clickable through to its records
- Series apiladas: usa `SERIES_PALETTE` / `SERIES_NEUTRALS` (`dashboard-ui.tsx`), no
  `CHART_PALETTE` — esta última no pasa la validación de contraste/CVD en un stack. Cinco
  tonos es el límite; una dimensión con más valores pliega su cola en "Otros"
  (`lib/month-series.ts`). El color se asigna sobre el set SIN filtrar, para que mover el
  filtro de fechas no repinte las series.
- Una leyenda propia (fuera del `ChartContainer`) **no ve** las variables `--color-<slot>`
  que emite `ChartStyle`: van bajo el selector `[data-chart=chart-<id>]`. Pásale un `id`
  al `ChartContainer` y marca el bloque de chips con el mismo `data-chart` —
  `campaign-month-chart.tsx` es el ejemplo. (La vieja regla "ningún encoding que
  requiera leyenda" se eliminó: una barra apilada la requiere por definición, y estos
  charts calcan un reporte que el cliente ya usa.)
- Never nest a scroll container inside a card. For narrow scrollable panels use a plain
  `overflow-y-auto` div — Radix `ScrollArea` breaks `truncate`
