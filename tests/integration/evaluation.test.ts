import { randomBytes } from "node:crypto";
import { createServer, type Server } from "node:http";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createTRPCClient, httpBatchLink, type TRPCClient } from "@trpc/client";
import superjson from "superjson";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createTestDatabase } from "../helpers/database";
import type { AppRouter } from "../../server/routers";
import type { DataFetchSummary } from "../../server/realtime";

// Only external intelligence is mocked. SQL, migrations, router procedures,
// tRPC serialization and the model's HTTP transport all run for real.
vi.mock("../../server/realtime", () => ({
  fetchAllRealTimeIntelligence: vi.fn(),
}));
import { fetchAllRealTimeIntelligence } from "../../server/realtime";

let database: Awaited<ReturnType<typeof createTestDatabase>>;
let api: Server;
let provider: Server;
let client: TRPCClient<AppRouter>;
let closeDb: () => Promise<void>;
let score = 25;
let providerFailure = false;
let invalidResult = false;
const calls: Array<{ schema: string; messages: Array<{ content: string }> }> =
  [];
const alternatives = [
  {
    name: "Alternative corridor",
    transitDays: 24,
    riskScore: 30,
    waypoints: [
      [121.8, 30.6],
      [103.8, 1.3],
      [4.5, 51.9],
    ],
    costImpact: "+3 transit days",
    description: "An illustrative alternative for this integration fixture.",
  },
];
const intelligence: DataFetchSummary = {
  events: [],
  fetchedAt: "2026-10-22T00:00:00.000Z",
  sources: [{ name: "Integration feed", count: 0, ok: true, sourceKind: "live" }],
};

async function listen(server: Server) {
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Test server failed to bind");
  return `http://127.0.0.1:${address.port}`;
}

async function stop(server?: Server) {
  if (!server?.listening) return;
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close(error => (error ? reject(error) : resolve()))
  );
}

beforeAll(async () => {
  const adminUrl = process.env.RISKWISE_TEST_DATABASE_URL;
  if (!adminUrl)
    throw new Error(
      "Set RISKWISE_TEST_DATABASE_URL to a development PostgreSQL connection with CREATE DATABASE permission. The suite creates and removes its own database."
    );
  database = await createTestDatabase(adminUrl);
  provider = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const request = JSON.parse(body);
    const schema = request.response_format.json_schema.name;
    calls.push({ schema, messages: request.messages });
    res.setHeader("content-type", "application/json");
    if (providerFailure) {
      res.writeHead(503);
      res.end(JSON.stringify({ error: "private-provider-detail" }));
      return;
    }
    const output =
      schema === "athena_result"
        ? {
            relevantDisruptions: [],
            intelligenceSummary:
              "Reviewed the available integration intelligence.",
          }
        : schema === "hermes_result"
          ? {
              overallRiskScore: invalidResult ? 999 : score,
              primaryRiskFactor: "Weather",
              breakdown: {
                weather: score,
                labor: 10,
                geopolitical: 20,
                congestion: 15,
              },
              riskNarrative: `Integration assessment at risk ${score}.`,
              baseTransitDays: 21,
            }
          : {
              alternativeRoutes: alternatives,
              recommendation: "Review the alternative corridor.",
            };
    res.end(
      JSON.stringify({
        id: "integration-completion",
        created: 0,
        model: "fixture",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: JSON.stringify(output) },
            finish_reason: "stop",
          },
        ],
      })
    );
  });
  const providerUrl = await listen(provider);
  process.env.DATABASE_URL = database.url;
  process.env.JWT_SECRET = randomBytes(48).toString("hex");
  process.env.RISKWISE_LLM_BASE_URL = `${providerUrl}/v1`;
  process.env.RISKWISE_LLM_API_KEY = "integration-fixture";
  process.env.RISKWISE_LLM_MODEL = "fixture";
  // Never use a developer's external alert webhook or per-agent model bindings.
  delete process.env.RISKWISE_ALERT_WEBHOOK_URL;
  for (const agent of ["ATHENA", "HERMES", "APOLLO"]) {
    for (const field of ["BASE_URL", "API_KEY", "MODEL"])
      delete process.env[`RISKWISE_${agent}_LLM_${field}`];
  }
  const { appRouter } = await import("../../server/routers");
  const { createContext } = await import("../../server/_core/context");
  ({ closeDb } = await import("../../server/db"));
  const app = express();
  app.use(express.json());
  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext })
  );
  api = createServer(app);
  const apiUrl = await listen(api);
  client = createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({ url: `${apiUrl}/api/trpc`, transformer: superjson }),
    ],
  });
});

beforeEach(async () => {
  vi.clearAllMocks();
  score = 25;
  providerFailure = false;
  invalidResult = false;
  calls.length = 0;
  vi.mocked(fetchAllRealTimeIntelligence).mockResolvedValue(intelligence);
  await database.sql`TRUNCATE route_evaluations, risk_events, shipping_routes, users RESTART IDENTITY CASCADE`;
});

afterAll(async () => {
  try {
    await stop(api);
    await stop(provider);
    await closeDb?.();
  } finally {
    await database?.close();
  }
});

describe("evaluation HTTP/database workflow", () => {
  it("persists a low-risk evaluation and reads it through serialized history", async () => {
    await database.sql`INSERT INTO risk_events (title, description, category, severity, affected_locations) VALUES ('Integration port delay', 'A seeded database event.', 'Weather', 'Medium', ${JSON.stringify(["Port of Shanghai"])}::json)`;
    const result = await client.routes.evaluate.mutate({
      origin: "  Port of   Shanghai ",
      destination: "Port of Rotterdam",
      queryText: "Test evaluation",
    });
    const history = await client.routes.history.query();
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      originPort: "Port of Shanghai",
      destinationPort: "Port of Rotterdam",
      overallRiskScore: result.overallRiskScore,
      breakdown: result.breakdown,
      riskNarrative: result.riskNarrative,
      intelligenceSummary: result.intelligenceSummary,
      dataSources: intelligence.sources,
      alternativeRoutes: [],
      queryText: "Test evaluation",
    });
    expect(history[0].evaluatedAt).toBeInstanceOf(Date);
    expect(calls.map(call => call.schema)).toEqual([
      "athena_result",
      "hermes_result",
    ]);
    expect(
      calls[0].messages.some(message =>
        message.content.includes("Integration port delay")
      )
    ).toBe(true);
    expect(fetchAllRealTimeIntelligence).toHaveBeenCalledTimes(1);
  });

  it("persists critical scores and Apollo alternatives as JSON", async () => {
    score = 85;
    const result = await client.routes.evaluate.mutate({
      origin: "Port of Shanghai",
      destination: "Port of Rotterdam",
    });
    expect(result.alternativeRoutes).toEqual(alternatives);
    expect(calls.map(call => call.schema)).toEqual([
      "athena_result",
      "hermes_result",
      "apollo_result",
    ]);
    const [row] =
      await database.sql`SELECT overall_risk_score, alternative_routes FROM route_evaluations`;
    expect(row.overall_risk_score).toBe(85);
    expect(row.alternative_routes).toEqual(alternatives);
  });

  it("reruns a saved route into a new row without overwriting the original", async () => {
    await client.routes.evaluate.mutate({
      origin: "Port of Shanghai",
      destination: "Port of Rotterdam",
    });
    const [original] = await client.routes.history.query();
    score = 65;
    const rerun = await client.routes.rerun.mutate({
      evaluationId: original.id,
    });
    const history = await client.routes.history.query();
    expect(history).toHaveLength(2);
    expect(history.find(row => row.id === original.id)).toEqual(original);
    expect(history.find(row => row.id !== original.id)).toMatchObject({
      originPort: original.originPort,
      destinationPort: original.destinationPort,
      overallRiskScore: rerun.overallRiskScore,
      alternativeRoutes: alternatives,
      queryText: `Re-run of evaluation #${original.id}`,
    });
    const trend = await client.routes.trend.query({
      originPort: original.originPort,
      destinationPort: original.destinationPort,
    });
    expect(trend.map(row => row.overallRiskScore)).toEqual([25, 65]);
  });

  it("reports missing evaluations without calling a model", async () => {
    await expect(
      client.routes.rerun.mutate({ evaluationId: 12345 })
    ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
    expect(calls).toHaveLength(0);
  });

  it("returns a safe provider failure and inserts no evaluation", async () => {
    providerFailure = true;
    const request = client.routes.evaluate.mutate({
      origin: "Shanghai",
      destination: "Rotterdam",
    });
    await expect(request).rejects.toMatchObject({
      data: { code: "BAD_GATEWAY" },
    });
    await expect(request).rejects.not.toThrow("private-provider-detail");
    expect(await client.routes.history.query()).toEqual([]);
  });

  it("preserves successful history when a rerun's provider fails", async () => {
    await client.routes.evaluate.mutate({
      origin: "Shanghai",
      destination: "Rotterdam",
    });
    const original = await client.routes.history.query();
    providerFailure = true;
    await expect(
      client.routes.rerun.mutate({ evaluationId: original[0].id })
    ).rejects.toMatchObject({ data: { code: "BAD_GATEWAY" } });
    expect(await client.routes.history.query()).toEqual(original);
  });

  it("keeps invalid model scores out of the database", async () => {
    invalidResult = true;
    await expect(
      client.routes.evaluate.mutate({
        origin: "Shanghai",
        destination: "Rotterdam",
      })
    ).rejects.toMatchObject({ data: { code: "BAD_GATEWAY" } });
    expect(await database.sql`SELECT id FROM route_evaluations`).toEqual([]);
  });

  it("filters real stored events and excludes inactive disruptions", async () => {
    await database.sql`INSERT INTO risk_events (title, description, category, severity, affected_locations, is_active) VALUES ('Weather fixture', 'A storm', 'Weather', 'High', '[]', true), ('Strike fixture', 'A strike', 'Strike', 'Medium', '[]', true), ('Old storm', 'Inactive', 'Weather', 'High', '[]', false)`;
    expect((await client.events.active.query()).map(row => row.title)).toEqual(
      expect.arrayContaining(["Weather fixture", "Strike fixture"])
    );
    expect(
      await client.events.active.query({
        category: "Weather",
        severity: "High",
      })
    ).toMatchObject([{ title: "Weather fixture" }]);
  });

  it("can reapply committed migrations without changing their history", async () => {
    await migrate(drizzle(database.sql), {
      migrationsFolder: new URL("../../drizzle", import.meta.url).pathname,
    });
    const [row] =
      await database.sql`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations`;
    expect(row.count).toBe(1);
  });
});
