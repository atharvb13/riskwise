# Graph Report - riskwise  (2026-06-09)

## Corpus Check
- 63 files · ~20,855 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 501 nodes · 759 edges · 19 communities (17 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8587c07a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Server Core and Auth|Server Core and Auth]]
- [[_COMMUNITY_Layout and Theme|Layout and Theme]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_LLM Integration|LLM Integration]]
- [[_COMMUNITY_Map and UI Hooks|Map and UI Hooks]]
- [[_COMMUNITY_Build Config|Build Config]]
- [[_COMMUNITY_Accordion and Utils|Accordion and Utils]]
- [[_COMMUNITY_Alert Dialog and Pages|Alert Dialog and Pages]]
- [[_COMMUNITY_Multi-Agent Design Docs|Multi-Agent Design Docs]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Component Aliases|Component Aliases]]
- [[_COMMUNITY_Template Config|Template Config]]
- [[_COMMUNITY_Error Types|Error Types]]
- [[_COMMUNITY_Error Boundary|Error Boundary]]
- [[_COMMUNITY_DB Migration Journal|DB Migration Journal]]
- [[_COMMUNITY_Vitest Config|Vitest Config]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 52 edges
2. `compilerOptions` - 15 edges
3. `getDb()` - 12 edges
4. `invokeLLM()` - 11 edges
5. `orchestrate()` - 9 edges
6. `fetchAllRealTimeIntelligence()` - 9 edges
7. `scripts` - 8 edges
8. `ENV` - 8 edges
9. `RiskWise Project` - 8 edges
10. `Architecture Portability Decision` - 8 edges

## Surprising Connections (you probably didn't know these)
- `RouteAnalyzer Page` --calls--> `Multi-Agent Orchestration (Athena/Hermes/Apollo)`  [EXTRACTED]
  riskwise-MOTHER_CONTEXT.md → CLAUDE.md
- `RiskWise Rework Plan v2` --references--> `PostgreSQL Migration (from MySQL)`  [EXTRACTED]
  RESTYLE_PLAN.md → CLAUDE.md
- `tRPC + Drizzle ORM` --implements--> `Database Schema (users, risk_events, shipping_routes, route_evaluations)`  [INFERRED]
  CLAUDE.md → riskwise-MOTHER_CONTEXT.md
- `MVP Scope Decision` --conceptually_related_to--> `ActiveDisruptions Page`  [EXTRACTED]
  CLAUDE.md → riskwise-MOTHER_CONTEXT.md
- `MVP Scope Decision` --conceptually_related_to--> `RouteAnalyzer Page`  [EXTRACTED]
  CLAUDE.md → riskwise-MOTHER_CONTEXT.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Multi-Agent Route Evaluation Pipeline** — claude_athena_agent, claude_hermes_agent, claude_apollo_agent, claude_realtime_fetchers, claude_risk_scoring [EXTRACTED 1.00]
- **Portability Rework: Auth + LLM + DB + Cron** — claude_jwt_auth, claude_llm_env_config, claude_postgresql_migration, claude_node_cron_scheduler, claude_portability_decision [EXTRACTED 1.00]
- **Observability Stack: Pino + Request IDs + Error Codes** — claude_pino_logger, claude_error_handling, claude_zod_validation [EXTRACTED 0.95]

## Communities (19 total, 2 thin omitted)

### Community 0 - "Server Core and Auth"
Cohesion: 0.06
Nodes (48): createContext(), resolveUser(), TrpcContext, getSessionCookieOptions(), isSecureRequest(), LOCAL_HOSTS, ENV, envSchema (+40 more)

### Community 1 - "Layout and Theme"
Cohesion: 0.06
Nodes (34): getCategoryColor(), getCategoryIcon(), getRiskBgClass(), getRiskBorderClass(), getRiskColor(), getRiskLabel(), getRiskTextClass(), getSeverityColor() (+26 more)

### Community 2 - "Package Dependencies"
Cohesion: 0.03
Nodes (65): dependencies, axios, class-variance-authority, clsx, cmdk, cookie, date-fns, dotenv (+57 more)

### Community 3 - "LLM Integration"
Cohesion: 0.09
Nodes (26): ensureArray(), FileContent, ImageContent, invokeLLM(), InvokeParams, InvokeResponse, InvokeResult, JsonSchema (+18 more)

### Community 4 - "Map and UI Hooks"
Cohesion: 0.06
Nodes (42): MapView(), MapViewProps, NAV_ITEMS, RiskWiseLayout(), RiskWiseLayoutProps, TimerResponse, useComposition(), UseCompositionOptions (+34 more)

### Community 6 - "Build Config"
Cohesion: 0.08
Nodes (24): devDependencies, autoprefixer, drizzle-kit, esbuild, pino-pretty, pnpm, postcss, prettier (+16 more)

### Community 7 - "Accordion and Utils"
Cohesion: 0.12
Nodes (16): license, name, tailwindcss>nanoid, packageManager, pnpm, overrides, scripts, build (+8 more)

### Community 8 - "Alert Dialog and Pages"
Cohesion: 0.14
Nodes (13): Architecture, Commands, Database, Dev server, Environment, Install, LLM options, Prerequisites (+5 more)

### Community 9 - "Multi-Agent Design Docs"
Cohesion: 0.10
Nodes (32): ActiveDisruptions Page, Apollo Agent (Route Optimizer), Athena Agent (Researcher), Cyberpunk Refined Aesthetic, Database Schema (users, risk_events, shipping_routes, route_evaluations), Structured Error Handling, Graphify Knowledge Graph Setup, Hermes Agent (Risk Modeler) (+24 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, baseUrl, esModuleInterop, incremental, jsx, lib, module (+11 more)

### Community 13 - "Component Aliases"
Cohesion: 0.12
Nodes (15): aliases, components, hooks, lib, ui, utils, rsc, $schema (+7 more)

### Community 16 - "Template Config"
Cohesion: 0.06
Nodes (50): findAvailablePort(), isPortAvailable(), startServer(), LLMConfig, AgentTelemetry, auditLogger, baseOptions, createLogger() (+42 more)

### Community 28 - "Error Boundary"
Cohesion: 0.10
Nodes (12): ErrorBoundary, Props, State, Theme, ThemeContext, ThemeContextType, ThemeProvider(), ThemeProviderProps (+4 more)

### Community 32 - "DB Migration Journal"
Cohesion: 0.50
Nodes (3): dialect, entries, version

## Knowledge Gaps
- **240 isolated node(s):** `NAV_ITEMS`, `RiskWiseLayoutProps`, `Category`, `Severity`, `CATEGORIES` (+235 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Map and UI Hooks` to `Layout and Theme`, `Error Boundary`?**
  _High betweenness centrality (0.102) - this node is a cross-community bridge._
- **Why does `AppRouter` connect `Server Core and Auth` to `Template Config`, `Layout and Theme`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Package Dependencies` to `Accordion and Utils`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **What connects `NAV_ITEMS`, `RiskWiseLayoutProps`, `Category` to the rest of the system?**
  _240 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Server Core and Auth` be split into smaller, more focused modules?**
  _Cohesion score 0.058173076923076925 - nodes in this community are weakly interconnected._
- **Should `Layout and Theme` be split into smaller, more focused modules?**
  _Cohesion score 0.06334841628959276 - nodes in this community are weakly interconnected._
- **Should `Package Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.03076923076923077 - nodes in this community are weakly interconnected._