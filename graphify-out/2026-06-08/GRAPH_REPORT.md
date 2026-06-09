# Graph Report - riskwise  (2026-06-08)

## Corpus Check
- 104 files · ~33,196 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 777 nodes · 1337 edges · 40 communities (35 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2ffc99bd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Server Core and Auth|Server Core and Auth]]
- [[_COMMUNITY_Layout and Theme|Layout and Theme]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_LLM Integration|LLM Integration]]
- [[_COMMUNITY_Map and UI Hooks|Map and UI Hooks]]
- [[_COMMUNITY_Sheet and Mobile UI|Sheet and Mobile UI]]
- [[_COMMUNITY_Build Config|Build Config]]
- [[_COMMUNITY_Accordion and Utils|Accordion and Utils]]
- [[_COMMUNITY_Alert Dialog and Pages|Alert Dialog and Pages]]
- [[_COMMUNITY_Multi-Agent Design Docs|Multi-Agent Design Docs]]
- [[_COMMUNITY_TypeScript Config|TypeScript Config]]
- [[_COMMUNITY_Button Group and Field|Button Group and Field]]
- [[_COMMUNITY_Menubar|Menubar]]
- [[_COMMUNITY_Component Aliases|Component Aliases]]
- [[_COMMUNITY_Context Menu|Context Menu]]
- [[_COMMUNITY_Dropdown Menu|Dropdown Menu]]
- [[_COMMUNITY_Template Config|Template Config]]
- [[_COMMUNITY_Carousel|Carousel]]
- [[_COMMUNITY_Form Components|Form Components]]
- [[_COMMUNITY_Item Components|Item Components]]
- [[_COMMUNITY_Utilities and Primitives|Utilities and Primitives]]
- [[_COMMUNITY_Chart Components|Chart Components]]
- [[_COMMUNITY_Drawer|Drawer]]
- [[_COMMUNITY_Select|Select]]
- [[_COMMUNITY_Navigation Menu|Navigation Menu]]
- [[_COMMUNITY_Error Types|Error Types]]
- [[_COMMUNITY_Breadcrumb|Breadcrumb]]
- [[_COMMUNITY_Empty States|Empty States]]
- [[_COMMUNITY_Error Boundary|Error Boundary]]
- [[_COMMUNITY_Toggle Group|Toggle Group]]
- [[_COMMUNITY_Alert|Alert]]
- [[_COMMUNITY_Popover|Popover]]
- [[_COMMUNITY_DB Migration Journal|DB Migration Journal]]
- [[_COMMUNITY_Hover Card|Hover Card]]
- [[_COMMUNITY_Resizable Panels|Resizable Panels]]
- [[_COMMUNITY_Vitest Config|Vitest Config]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 283 edges
2. `compilerOptions` - 15 edges
3. `getDb()` - 12 edges
4. `invokeLLM()` - 10 edges
5. `buttonVariants` - 9 edges
6. `Button()` - 9 edges
7. `fetchAllRealTimeIntelligence()` - 9 edges
8. `RiskWise Project` - 9 edges
9. `scripts` - 8 edges
10. `orchestrate()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Client Entry HTML` --implements--> `RiskWise Project`  [EXTRACTED]
  client/index.html → CLAUDE.md
- `RouteAnalyzer Page` --calls--> `Multi-Agent Orchestration (Athena/Hermes/Apollo)`  [EXTRACTED]
  riskwise-MOTHER_CONTEXT.md → CLAUDE.md
- `RiskWise Rework Plan v2` --references--> `PostgreSQL Migration (from MySQL)`  [EXTRACTED]
  RESTYLE_PLAN.md → CLAUDE.md
- `tRPC + Drizzle ORM` --implements--> `Database Schema (users, risk_events, shipping_routes, route_evaluations)`  [INFERRED]
  CLAUDE.md → riskwise-MOTHER_CONTEXT.md
- `MVP Scope Decision` --conceptually_related_to--> `ActiveDisruptions Page`  [EXTRACTED]
  CLAUDE.md → riskwise-MOTHER_CONTEXT.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Multi-Agent Route Evaluation Pipeline** — claude_athena_agent, claude_hermes_agent, claude_apollo_agent, claude_realtime_fetchers, claude_risk_scoring [EXTRACTED 1.00]
- **Portability Rework: Auth + LLM + DB + Cron** — claude_jwt_auth, claude_llm_env_config, claude_postgresql_migration, claude_node_cron_scheduler, claude_portability_decision [EXTRACTED 1.00]
- **Observability Stack: Pino + Request IDs + Error Codes** — claude_pino_logger, claude_error_handling, claude_zod_validation [EXTRACTED 0.95]

## Communities (40 total, 5 thin omitted)

### Community 0 - "Server Core and Auth"
Cohesion: 0.05
Nodes (56): createContext(), resolveUser(), TrpcContext, getSessionCookieOptions(), isSecureRequest(), LOCAL_HOSTS, ENV, envSchema (+48 more)

### Community 1 - "Layout and Theme"
Cohesion: 0.06
Nodes (40): NAV_ITEMS, RiskWiseLayout(), RiskWiseLayoutProps, Theme, ThemeContext, ThemeContextType, ThemeProvider(), ThemeProviderProps (+32 more)

### Community 2 - "Package Dependencies"
Cohesion: 0.03
Nodes (64): dependencies, axios, class-variance-authority, clsx, cmdk, cookie, date-fns, dotenv (+56 more)

### Community 3 - "LLM Integration"
Cohesion: 0.05
Nodes (50): assertApiKey(), ensureArray(), FileContent, ImageContent, invokeLLM(), InvokeParams, InvokeResult, JsonSchema (+42 more)

### Community 4 - "Map and UI Hooks"
Cohesion: 0.06
Nodes (36): MapView(), MapViewProps, Window, TimerResponse, useComposition(), UseCompositionOptions, UseCompositionReturn, noop (+28 more)

### Community 5 - "Sheet and Mobile UI"
Cohesion: 0.07
Nodes (33): useIsMobile(), Sidebar(), SidebarContent(), SidebarContext, SidebarContextProps, SidebarFooter(), SidebarGroup(), SidebarGroupAction() (+25 more)

### Community 6 - "Build Config"
Cohesion: 0.05
Nodes (41): devDependencies, autoprefixer, drizzle-kit, esbuild, pino-pretty, pnpm, postcss, prettier (+33 more)

### Community 7 - "Accordion and Utils"
Cohesion: 0.08
Nodes (33): cn(), Avatar(), AvatarFallback(), AvatarImage(), BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList() (+25 more)

### Community 8 - "Alert Dialog and Pages"
Cohesion: 0.07
Nodes (26): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogTitle() (+18 more)

### Community 9 - "Multi-Agent Design Docs"
Cohesion: 0.10
Nodes (33): ActiveDisruptions Page, Apollo Agent (Route Optimizer), Athena Agent (Researcher), Cyberpunk Refined Aesthetic, Database Schema (users, risk_events, shipping_routes, route_evaluations), Structured Error Handling, Graphify Knowledge Graph Setup, Hermes Agent (Risk Modeler) (+25 more)

### Community 10 - "TypeScript Config"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, baseUrl, esModuleInterop, incremental, jsx, lib, module (+11 more)

### Community 11 - "Button Group and Field"
Cohesion: 0.13
Nodes (16): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Field(), FieldContent(), FieldDescription(), FieldError() (+8 more)

### Community 12 - "Menubar"
Cohesion: 0.18
Nodes (7): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle()

### Community 13 - "Component Aliases"
Cohesion: 0.12
Nodes (15): aliases, components, hooks, lib, ui, utils, rsc, $schema (+7 more)

### Community 14 - "Context Menu"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 15 - "Dropdown Menu"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 16 - "Template Config"
Cohesion: 0.40
Nodes (3): InputOTP(), InputOTPGroup(), InputOTPSlot()

### Community 17 - "Carousel"
Cohesion: 0.19
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 18 - "Form Components"
Cohesion: 0.20
Nodes (11): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItem(), FormItemContext, FormItemContextValue, FormLabel() (+3 more)

### Community 19 - "Item Components"
Cohesion: 0.18
Nodes (12): Item(), ItemActions(), ItemContent(), ItemDescription(), ItemFooter(), ItemGroup(), ItemHeader(), ItemMedia() (+4 more)

### Community 20 - "Utilities and Primitives"
Cohesion: 0.10
Nodes (12): AccordionContent(), AccordionItem(), AccordionTrigger(), Badge(), badgeVariants, Checkbox(), Progress(), RadioGroup() (+4 more)

### Community 21 - "Chart Components"
Cohesion: 0.22
Nodes (8): ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent(), THEMES, useChart()

### Community 22 - "Drawer"
Cohesion: 0.18
Nodes (6): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 23 - "Select"
Cohesion: 0.18
Nodes (7): SelectContent(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton(), SelectSeparator(), SelectTrigger()

### Community 24 - "Navigation Menu"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 26 - "Breadcrumb"
Cohesion: 0.40
Nodes (4): Tabs(), TabsContent(), TabsList(), TabsTrigger()

### Community 27 - "Empty States"
Cohesion: 0.29
Nodes (7): Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle()

### Community 28 - "Error Boundary"
Cohesion: 0.29
Nodes (3): ErrorBoundary, Props, State

### Community 29 - "Toggle Group"
Cohesion: 0.43
Nodes (5): ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 30 - "Alert"
Cohesion: 0.50
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

### Community 32 - "DB Migration Journal"
Cohesion: 0.50
Nodes (3): dialect, entries, version

## Knowledge Gaps
- **232 isolated node(s):** `Props`, `State`, `Window`, `MapViewProps`, `NAV_ITEMS` (+227 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `Accordion and Utils` to `Layout and Theme`, `Map and UI Hooks`, `Sheet and Mobile UI`, `Alert Dialog and Pages`, `Button Group and Field`, `Menubar`, `Context Menu`, `Dropdown Menu`, `Template Config`, `Carousel`, `Form Components`, `Item Components`, `Utilities and Primitives`, `Chart Components`, `Drawer`, `Select`, `Navigation Menu`, `Breadcrumb`, `Empty States`, `Error Boundary`, `Toggle Group`, `Alert`, `Popover`, `Hover Card`, `Resizable Panels`?**
  _High betweenness centrality (0.417) - this node is a cross-community bridge._
- **Why does `AppRouter` connect `Server Core and Auth` to `Layout and Theme`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `ENV` connect `Server Core and Auth` to `LLM Integration`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `Props`, `State`, `Window` to the rest of the system?**
  _232 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Server Core and Auth` be split into smaller, more focused modules?**
  _Cohesion score 0.05228105228105228 - nodes in this community are weakly interconnected._
- **Should `Layout and Theme` be split into smaller, more focused modules?**
  _Cohesion score 0.05593220338983051 - nodes in this community are weakly interconnected._
- **Should `Package Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.03125 - nodes in this community are weakly interconnected._