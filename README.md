# RiskWise

**Maritime route-risk analysis with traceable intelligence.**

[![CI](https://github.com/atharvb13/riskwise/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/atharvb13/riskwise/actions/workflows/ci.yml)

RiskWise brings shipping-route analysis, disruption reports, and evaluation history into one workspace. Enter an origin and destination, review weather, geopolitical, labor, and congestion risk, and explore suggested alternatives when the model flags elevated risk.

Source provenance is part of the result: live reports, static baselines, unavailable feeds, and older records are labelled separately.

[Quickstart](#quickstart) · [How it works](#how-it-works) · [Configuration](#configuration) · [Testing](#testing) · [Improvement plan](docs/IMPROVEMENT_PLAN.md)

## What you can do

- **Analyze a route.** Use port names, catalog codes such as `CNSHA`, or a query such as `from Shanghai to Rotterdam`. Get an overall risk score, a factor breakdown, an intelligence summary, and a narrative assessment.
- **Review alternatives.** Apollo suggests alternative routes when the model's risk score exceeds 50, with estimated transit time, risk, cost impact, and approximate waypoints.
- **Inspect the evidence.** Disruption cards distinguish source observation time from the most recent source check and link to available supporting material.
- **Explore the map.** View available shipping routes, recent evaluated connections, and geographically matched disruptions on a MapLibre basemap.
- **Compare evaluations.** Review saved results, inspect route trends, and rerun an evaluation without overwriting its original record.

## Quickstart

### Prerequisites

- **Node.js 24**, matching the CI environment.
- **pnpm 10.4.1**, pinned in [package.json](package.json). The commands below use Corepack to select the pinned version.
- **PostgreSQL**; version 17 is used in CI.
- **A model service**: local [Ollama](https://ollama.com/) or a hosted OpenAI-compatible endpoint that supports structured JSON responses.

The application and database are enough to browse stored history and the disruption feed. New route evaluations also require a working configured model.

### 1. Install dependencies

```bash
git clone https://github.com/atharvb13/riskwise.git
cd riskwise
corepack enable
pnpm install --frozen-lockfile
```

If Corepack is unavailable in your Node installation, follow the [pnpm installation instructions](https://pnpm.io/installation) and use the version pinned by this repository.

### 2. Prepare PostgreSQL

Create a database named `riskwise` using your existing PostgreSQL installation, or start a local instance with Docker:

```bash
docker run --name riskwise-postgres \
  -e POSTGRES_USER=riskwise \
  -e POSTGRES_PASSWORD=local-development-only \
  -e POSTGRES_DB=riskwise \
  -p 127.0.0.1:5432:5432 \
  -v riskwise-postgres-data:/var/lib/postgresql/data \
  -d postgres:17
```

The connection string in the next step matches this local Docker example. Substitute your own database credentials when using an existing instance.

### 3. Configure the application

Create `.env` in the repository root:

```dotenv
DATABASE_URL=postgresql://riskwise:local-development-only@localhost:5432/riskwise
JWT_SECRET=replace-with-a-generated-secret
PORT=5000

RISKWISE_LLM_BASE_URL=http://localhost:11434/v1
RISKWISE_LLM_API_KEY=ollama
RISKWISE_LLM_MODEL=mistral
RISKWISE_LLM_TIMEOUT_MS=180000
```

Generate a random signing secret and use its output for `JWT_SECRET`, which must contain at least 32 characters:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Keep `.env` local; it is ignored by Git. These are development settings, including the example database password.

### 4. Start the model service

For local Ollama, start its server in a separate terminal if it is not already running:

```bash
ollama serve
```

Then download the configured model from another terminal:

```bash
ollama pull mistral
```

For a hosted provider, replace the three model settings in `.env`:

```dotenv
RISKWISE_LLM_BASE_URL=https://api.openai.com/v1
RISKWISE_LLM_API_KEY=your-provider-api-key
RISKWISE_LLM_MODEL=your-supported-model
```

Choose a model that supports the `json_schema` response format. Other providers can be connected through an endpoint or gateway exposing the same OpenAI-compatible chat-completions protocol.

### 5. Apply migrations and start development

From the repository root:

```bash
pnpm db:migrate
pnpm dev
```

Open the address printed in the server log. The configuration above requests port **5000**; without `PORT`, the server defaults to **3000**. If the preferred port is occupied, it tries subsequent ports.

A source scan runs shortly after startup and then hourly. The interface refreshes its feed view separately from those scans.

## How it works

Route evaluations use up to three model agents:

| Agent      | Responsibility                                                                                              | Runs when              |
| ---------- | ----------------------------------------------------------------------------------------------------------- | ---------------------- |
| **Athena** | Researches the route using retrieved intelligence, stored evidence, and explicitly labelled static context. | Every evaluation       |
| **Hermes** | Produces the overall score, four-factor breakdown, risk narrative, and estimated base transit time.         | Every evaluation       |
| **Apollo** | Suggests alternative corridors with estimated risk, transit time, cost impact, and waypoints.               | Model score exceeds 50 |

```mermaid
flowchart LR
    route["Origin and destination"] --> athena["Athena: research"]
    feeds["RSS, NASA EONET, USGS"] --> athena
    context["Stored evidence and static baselines"] --> athena
    athena --> hermes["Hermes: scoring"]
    hermes --> decision{"Score > 50?"}
    decision -->|Yes| apollo["Apollo: alternatives"]
    decision -->|No| result["Result and saved history"]
    apollo --> result
```

Model results are validated before persistence. Invalid analyses are rejected, provider error details are withheld from client responses, and each model call has a configurable timeout covering connection and response-body reading.

### Reading the score

| Score  | Label         | Display |
| ------ | ------------- | ------- |
| 0–30   | Low risk      | Green   |
| 31–60  | Moderate risk | Amber   |
| 61–75  | High risk     | Red     |
| 76–100 | Critical risk | Red     |

Scores above 75 trigger a logged alert and, when configured, an HTTP webhook. The threshold for requesting alternatives is **above 50**, so alternatives may also appear for a moderate-risk evaluation.

## Data provenance and freshness

| Input                  | Source                                   | Interpretation                                                                                     |
| ---------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| News reports           | BBC World, Al Jazeera, and NYT World RSS | Retrieved reports classified for shipping relevance; source availability varies.                   |
| Environmental events   | NASA EONET                               | Active events with available geographic and observation metadata.                                  |
| Earthquakes            | USGS                                     | Significant events selected from the daily earthquake feed.                                        |
| Static country context | Bundled RiskWise baseline table          | Illustrative background assumptions, not current disruption reports or a live external risk index. |

Background scans **never generate news with a model**. They retain evidence links and stable source identities, update repeated sightings in place, and preserve the distinction between:

- `observedAt`: the source's observation or publication time, when available.
- `lastSeenAt`: the latest time the application retrieved that record.
- `createdAt`: when the record first entered the database.

Records not confirmed within **24 hours** are excluded from active reads and deactivated by subsequent scans. A recent retrieval does not make an older observation newly published. Static baselines show when their context was loaded rather than claiming a live observation time.

Repeated scans use unique source fingerprints, atomic database transactions, and overlap protection. Unverified records from older versions remain stored as `legacy` but are excluded from the active feed and new analyses. Historical evaluations display their source snapshot rather than implying those feeds are available now.

### Port names and map coverage

The client and server share a [port catalog](shared/ports.ts). Known names, aliases (such as Busan/Pusan), and catalog codes resolve to one canonical name. Adjacent ports and named terminals remain distinct. Port fields offer catalog suggestions, and two aliases for the same endpoint are rejected.

You can analyze named ports outside the catalog, but RiskWise does not invent their coordinates or place them at `[0, 0]`. Their map connections are omitted. Catalog coordinates describe approximate port areas, not berths.

## Configuration

The server loads `.env` from the repository root. Environment variables already supplied to the process take precedence.

| Variable                     | Required / default                           | Purpose                                                                           |
| ---------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------- |
| `DATABASE_URL`               | Required                                     | PostgreSQL connection string.                                                     |
| `JWT_SECRET`                 | Required; at least 32 characters             | Signing secret used by session utilities.                                         |
| `PORT`                       | `3000`                                       | Preferred HTTP port; the quickstart sets `5000`.                                  |
| `RISKWISE_LLM_BASE_URL`      | `http://localhost:11434/v1`                  | OpenAI-compatible API base URL.                                                   |
| `RISKWISE_LLM_API_KEY`       | `ollama`                                     | Model-service key; replace for a hosted provider.                                 |
| `RISKWISE_LLM_MODEL`         | `mistral`                                    | Model identifier exposed by the configured service.                               |
| `RISKWISE_LLM_TIMEOUT_MS`    | `180000`                                     | Per-call timeout, from `1000` to `600000` milliseconds.                           |
| `LOG_LEVEL`                  | `debug` in development, `info` in production | Pino log level.                                                                   |
| `RISKWISE_ALERT_WEBHOOK_URL` | Optional                                     | Receives a JSON POST containing `title`, `content`, and `ts` for critical alerts. |

Each agent can override the global model configuration using `RISKWISE_<AGENT>_LLM_BASE_URL`, `RISKWISE_<AGENT>_LLM_API_KEY`, and `RISKWISE_<AGENT>_LLM_MODEL`, where `<AGENT>` is `ATHENA`, `HERMES`, or `APOLLO`. Unset overrides fall back to the global values.

## Commands

Run these from the repository root:

| Command                 | Purpose                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| `pnpm dev`              | Start the Express server with Vite and server-side file watching.          |
| `pnpm build`            | Build the frontend and bundle the server into `dist/`.                     |
| `pnpm start`            | Run the existing production build.                                         |
| `pnpm check`            | Check application TypeScript types.                                        |
| `pnpm test`             | Run unit and regression tests.                                             |
| `pnpm test:integration` | Run the PostgreSQL/API integration suite with an explicit test connection. |
| `pnpm db:migrate`       | Apply committed database migrations.                                       |
| `pnpm db:push`          | Generate new migration files and immediately apply them.                   |
| `pnpm format`           | Format the repository with Prettier.                                       |

Use `pnpm db:migrate` for setup and upgrades. `pnpm db:push` also changes migration source files and is intended for deliberate schema development.

## Testing

### Unit and regression checks

```bash
pnpm check
pnpm test
pnpm build
```

Coverage includes route-input parsing, agent-result validation, safe model errors and timeouts, source provenance, evidence-link handling, escaped map text, scan coalescing, and recovery after failures.

### PostgreSQL integration checks

Supply a development PostgreSQL connection whose role has `CREATE DATABASE` permission:

```bash
RISKWISE_TEST_DATABASE_URL=postgresql://user:password@localhost:5432/postgres pnpm test:integration
```

The suite creates a UUID-named database, applies the committed migrations, and removes only that database afterward. It does not reset or migrate the database named in the supplied connection. A missing test connection is an error rather than a silently skipped run.

These checks exercise real SQL, HTTP model transport, and tRPC serialization, including evaluation persistence, high-risk alternatives, reruns, deduplication, expiry, older-response protection, cross-worker locks, and transaction rollback. Model responses and external intelligence feeds are controlled fixtures; no model API key is needed and no external alert webhook is called.

[GitHub Actions](.github/workflows/ci.yml) runs type checking, both test suites, and the production build on pushes to `main` and pull requests, using Node.js 24 and PostgreSQL 17. Controlled-provider tests do not establish the accuracy or compatibility of a real configured model.

## Project layout

```text
client/src/
  pages/                 Map, route analyzer, disruption feed, and history
  components/            Shared interface and evidence presentation
  lib/                   tRPC client and display utilities
server/
  agents.ts              Athena, Hermes, and Apollo orchestration
  realtime.ts            External-source retrieval and static baseline context
  scheduledHandlers.ts   Coalesced background scans
  db.ts                  Queries and atomic intelligence refreshes
  routers/               Route evaluation, history, and disruption procedures
  _core/                 Express setup, model client, configuration, and logging
shared/                  Shared types, validation, and evidence helpers
drizzle/                 PostgreSQL schema and committed migrations
tests/integration/       HTTP/database workflow coverage
docs/IMPROVEMENT_PLAN.md Priorities, acceptance checks, and delivery notes
```

The frontend uses React 19, Tailwind CSS 4, Wouter, shadcn/ui components, TanStack Query, and MapLibre GL. The backend uses Express 4, tRPC 11, Drizzle ORM, Zod, Pino, and node-cron.

## Troubleshooting

| Symptom                                        | Check                                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Server exits with environment errors           | Confirm `.env` is at the repository root, `DATABASE_URL` is set, and `JWT_SECRET` has at least 32 characters.                                                |
| Database connection fails                      | Check that PostgreSQL is running and the database, role, password, and port match `DATABASE_URL`.                                                            |
| Missing database tables or columns             | Apply the committed migrations with `pnpm db:migrate`.                                                                                                       |
| Configured model is unavailable                | Check the endpoint and model identifier. For Ollama, inspect `ollama list` and pull the configured model after starting the server.                          |
| Model requests time out                        | Check provider availability and local resources; choose a suitable model or adjust the per-call timeout within its supported range.                          |
| A feed is unavailable or only baselines appear | Check access to the RSS publishers, `eonet.gsfc.nasa.gov`, and `earthquake.usgs.gov`. A healthy database response does not prove a live source is reachable. |
| Server uses an unexpected port                 | Read the startup log; the server selects a later port when the preferred one is occupied.                                                                    |

When developing behind an HTTP proxy on Node.js 24, enable `NODE_USE_ENV_PROXY=1` and add `localhost` and `127.0.0.1` to your existing `NO_PROXY` setting so local services remain reachable.

## Development status

RiskWise is under active development. The [improvement plan](docs/IMPROVEMENT_PLAN.md) records completed work, validation evidence, and remaining priorities, including real-model end-to-end verification.

Current boundaries:

- Risk scores and alternative routes are model-generated estimates. Port-coordinate coverage is limited, and map connections and waypoints are approximate rather than validated navigable shipping tracks.
- Session/JWT utilities exist, but route evaluation, history, and disruption procedures are currently public. Account registration, login, and private per-user histories are not complete.
- Live-source availability varies, and static country baselines do not establish current conditions. Observation time and retrieval time should be assessed separately.
