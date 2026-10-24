# RiskWise

Maritime supply chain intelligence platform. Evaluate shipping routes for geopolitical, weather, labor, and congestion risk using a multi-agent AI pipeline. Get risk scores, narratives, alternative routes, and a live disruption feed.

See the [10-day improvement plan](docs/IMPROVEMENT_PLAN.md) for the current priorities and acceptance checks. Deployment is deferred.

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Tailwind CSS 4, Wouter, shadcn/ui |
| Backend | Node.js, Express 4, tRPC 11, Drizzle ORM |
| Database | PostgreSQL |
| AI | OpenAI-compatible API (Ollama locally, OpenAI/Anthropic in prod) |
| Auth | JWT via jose, cookie-based sessions |
| Logging | Pino (structured JSON) |
| Scheduling | node-cron (hourly Athena background scan) |

---

## Architecture

Three agents collaborate on every route evaluation:

- **Athena** - researcher. Fetches sourced observations from BBC/Al Jazeera/NYT RSS, NASA EONET, and USGS. Hourly scans store those observations and explicitly labelled static country baselines; they never generate news with a model. Evidence links and source observation times are retained separately from retrieval times.
- **Hermes** - risk modeler. Scores weather, geopolitical, labor, and congestion risk on a 0-100 scale, with per-factor breakdown.
- **Apollo** - route optimizer. Suggests alternative routes when overall risk is high.

Risk thresholds: Green (0-30), Amber (31-60), Red (61-100). Critical alerts (score > 75) fire a console log and optional webhook.

---

## Running Locally

### Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL
- [Ollama](https://ollama.ai) for local LLM, or an OpenAI/Anthropic API key

### Install

```bash
pnpm install
```

### Environment

Create `.env` at the project root:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/riskwise
JWT_SECRET=your-secret-minimum-32-characters-long

# LLM config (defaults to Ollama + Mistral)
RISKWISE_LLM_BASE_URL=http://localhost:11434/v1
RISKWISE_LLM_API_KEY=ollama
RISKWISE_LLM_MODEL=mistral
# Per model call, including response-body reading (1,000–600,000 ms)
RISKWISE_LLM_TIMEOUT_MS=180000

# Optional
GOOGLE_MAPS_API_KEY=
RISKWISE_ALERT_WEBHOOK_URL=
```

### Database

```bash
pnpm db:migrate
```

### Dev server

```bash
pnpm dev
# http://localhost:5000
```

### LLM options

**Ollama (local, no API key):**
```bash
ollama pull mistral && ollama serve
```

**OpenAI:**
```env
RISKWISE_LLM_BASE_URL=https://api.openai.com/v1
RISKWISE_LLM_API_KEY=sk-...
RISKWISE_LLM_MODEL=gpt-4o
```

**Anthropic** (via OpenAI-compatible proxy or gateway):
```env
RISKWISE_LLM_MODEL=claude-sonnet-4-5
```

---

## Commands

```bash
pnpm dev        # start dev server
pnpm build      # production build
pnpm start      # run production build
pnpm test       # vitest (61 tests)
pnpm test:integration # HTTP/model-transport/PostgreSQL integration suite
pnpm check      # TypeScript type check
pnpm format     # Prettier
pnpm db:push    # generate + apply DB migrations
pnpm db:migrate # apply committed migrations without generating new files
```

---

## Project Structure

```
client/src/
  pages/          RouteAnalyzer, ActiveDisruptions, RouteHistory, MapView
  components/     reusable UI + shadcn/ui primitives
  contexts/       ThemeContext, RouteMapContext
  hooks/          custom hooks
  lib/trpc.ts     tRPC client binding
  App.tsx         routing
  index.css       global styles, Tailwind config, cyberpunk tokens

server/
  agents.ts             Athena / Hermes / Apollo orchestration
  db.ts                 Drizzle query helpers
  realtime.ts           live data fetchers (GDELT, NASA EONET, USGS)
  scheduledHandlers.ts  hourly Athena scan via node-cron
  routers.ts            tRPC router assembly
  routers/riskwise.ts   route eval, history, disruptions, auth procedures
  _core/
    index.ts        Express app, middleware, request ID, Maps proxy
    context.ts      tRPC context + JWT resolution
    env.ts          Zod-validated env config (fails fast on missing vars)
    llm.ts          OpenAI-compatible LLM client
    logger.ts       Pino instance
    notification.ts console + optional webhook alerts
    errors.ts       typed HTTP error classes

shared/
  const.ts          cookie name, shared constants
  types.ts          re-exports DB types + error classes
  _core/errors.ts   HttpError base class

drizzle/
  schema.ts         PostgreSQL schema (users, risk_events, shipping_routes, route_evaluations)
  0000_init.sql     initial migration
```

---

## Tests

61 tests across five files cover:
- Existing risk thresholds, router procedures, and logout behavior
- Agent-result validation, geographic bounds, and prevention of invalid evaluation persistence
- Model failures, safe provider errors, output-token limits, and connection/body timeouts
- A shared live-intelligence snapshot for research and source reporting
- Example-query parsing, partial port entry, and invalid direct API requests

For route queries, use a form such as `from Shanghai to Rotterdam`, or fill in both port fields. Explicit port fields take precedence over ports inferred from a query. Blank, oversized, and identical endpoints are rejected before model work begins.

Browser failure/retry scenarios are checked separately from real-model evaluations; the latter require a running model service and an available configured model.

### Intelligence refresh and schema upgrades

Run `pnpm db:migrate` before starting this version. The provenance migration preserves existing rows and their original age, marking records without evidence metadata as `legacy`. Those records remain stored but are excluded from the active feed and new analyses; source-backed scans populate current observations and labelled baselines.

Scans refresh observations by provider and stable source identity. Repeated sightings update `lastSeenAt` without changing the first-seen `createdAt` or substituting retrieval time for source `observedAt`. Records not confirmed within 24 hours are excluded on reads and deactivated by subsequent scans. Static baselines remain explicitly distinct from live observations. Concurrent triggers share one scan per process; database advisory locks and unique fingerprints protect refreshes across workers. An older queued response cannot overwrite a newer observation, and a failed batch rolls back its writes.

### Database integration tests

Use a development PostgreSQL connection whose user can create databases:

```bash
RISKWISE_TEST_DATABASE_URL=postgresql://user:password@localhost:5432/postgres pnpm test:integration
```

The suite creates a fresh UUID-named database, applies the committed migration, and removes only that database afterward. It does not reset or migrate the database named in the supplied connection. The connection must be supplied explicitly; the suite fails if it is missing.

These nine tests exercise real PostgreSQL queries, model HTTP requests, tRPC serialization, high-risk alternatives, reruns, validation failures, and provider outages. Intelligence feeds and model responses are controlled fixtures, so the suite requires no model API key and makes no external alert requests. The GitHub Actions workflow runs these checks against a PostgreSQL service in addition to unit tests, type checking, and the build.

---

*RiskWise was initially ideated and bootstrapped using [Manus AI](https://manus.im) for the Manus AI Hackathon at Boston Tech Week 2026.*
