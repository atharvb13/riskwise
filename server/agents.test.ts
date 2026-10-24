import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InvokeResponse } from "./_core/llm";

vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));
vi.mock("./realtime", () => ({ fetchAllRealTimeIntelligence: vi.fn() }));
vi.mock("./db", () => ({
  getActiveRiskEvents: vi.fn().mockResolvedValue([]),
  insertRouteEvaluation: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
import { fetchAllRealTimeIntelligence } from "./realtime";
import { insertRouteEvaluation } from "./db";
import {
  orchestrate,
  runApollo,
  runHermes,
  runAthenaScan,
  type HermesResult,
} from "./agents";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const intelligence = {
  events: [],
  fetchedAt: "2026-10-21T00:00:00.000Z",
  sources: [{ name: "Test feed", count: 0, ok: true, sourceKind: "live" as const }],
};
const athena = {
  relevantDisruptions: [],
  intelligenceSummary:
    "No route-specific disruptions in the available sources.",
};
const hermes: HermesResult = {
  overallRiskScore: 35,
  primaryRiskFactor: "Weather",
  breakdown: { weather: 35, labor: 10, geopolitical: 20, congestion: 15 },
  riskNarrative: "Moderate weather risk along the route.",
  baseTransitDays: 18,
};

function completion(content: unknown): InvokeResponse {
  return {
    id: "test-completion",
    created: 0,
    model: "test",
    _model: "test",
    _latencyMs: 1,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content:
            typeof content === "string" ? content : JSON.stringify(content),
        },
        finish_reason: "stop",
      },
    ],
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchAllRealTimeIntelligence).mockResolvedValue(intelligence);
});

describe("validated agent results", () => {
  it.each([
    { origin: "   ", destination: "Rotterdam" },
    { origin: "Shanghai", destination: "PORT OF SHANGHAI" },
    { origin: "x".repeat(101), destination: "Rotterdam" },
  ])(
    "rejects invalid route inputs before database or model work: %j",
    async input => {
      const caller = appRouter.createCaller({
        user: null,
        req: { headers: {} },
        res: {},
      } as TrpcContext);
      await expect(caller.routes.evaluate(input)).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
      expect(fetchAllRealTimeIntelligence).not.toHaveBeenCalled();
      expect(invokeLLM).not.toHaveBeenCalled();
      expect(insertRouteEvaluation).not.toHaveBeenCalled();
    }
  );

  it("stops the pipeline when Athena omits required intelligence fields", async () => {
    vi.mocked(invokeLLM).mockResolvedValue(
      completion({ relevantDisruptions: [] })
    );
    await expect(
      orchestrate("Shanghai", "Rotterdam", [])
    ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    expect(invokeLLM).toHaveBeenCalledTimes(1);
  });

  it("never generates a synthetic disruption when no source events are available", async () => {
    await expect(runAthenaScan()).resolves.toEqual(intelligence);
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("propagates a collection failure without inventing a news event", async () => {
    vi.mocked(fetchAllRealTimeIntelligence).mockRejectedValue(new Error("Collection failed"));
    await expect(runAthenaScan()).rejects.toThrow("Collection failed");
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("uses the same live snapshot for Athena's analysis and source reporting", async () => {
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce(completion(athena))
      .mockResolvedValueOnce(completion(hermes));
    const result = await orchestrate(
      "Port of Shanghai",
      "Port of Rotterdam",
      []
    );
    expect(fetchAllRealTimeIntelligence).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      overallRiskScore: 35,
      dataSources: intelligence.sources,
      riskNarrative: hermes.riskNarrative,
    });
    expect(invokeLLM).toHaveBeenCalledTimes(2);
  });

  it("still evaluates from database context when the live fetch fails, without retrying every feed", async () => {
    vi.mocked(fetchAllRealTimeIntelligence).mockRejectedValue(
      new Error("Feed unavailable")
    );
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce(completion(athena))
      .mockResolvedValueOnce(completion(hermes));
    const result = await orchestrate("Shanghai", "Rotterdam", []);
    expect(result.dataSources).toEqual([]);
    expect(fetchAllRealTimeIntelligence).toHaveBeenCalledTimes(1);
  });

  it.each([
    { ...hermes, overallRiskScore: 101 },
    { ...hermes, breakdown: { ...hermes.breakdown, weather: -1 } },
    { ...hermes, baseTransitDays: 0 },
    { ...hermes, baseTransitDays: 1.5 },
    { ...hermes, riskNarrative: " " },
    {},
    "not JSON",
  ])(
    "rejects invalid Hermes output before it can become an evaluation: %j",
    async content => {
      vi.mocked(invokeLLM).mockResolvedValue(completion(content));
      await expect(
        runHermes("Shanghai", "Rotterdam", athena)
      ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    }
  );

  it("accepts a valid JSON result wrapped in a model's markdown fence", async () => {
    vi.mocked(invokeLLM).mockResolvedValue(
      completion(`\`\`\`json\n${JSON.stringify(hermes)}\n\`\`\``)
    );
    await expect(runHermes("Shanghai", "Rotterdam", athena)).resolves.toEqual(
      hermes
    );
  });

  it("rejects impossible coordinates instead of passing them to the map", async () => {
    vi.mocked(invokeLLM).mockResolvedValue(
      completion({
        alternativeRoutes: [
          {
            name: "Alternative",
            transitDays: 20,
            riskScore: 25,
            waypoints: [
              [120, 30],
              [190, 95],
            ],
            costImpact: "+2 days",
            description: "Alternative corridor",
          },
        ],
        recommendation: "Use the alternative.",
      })
    );
    await expect(
      runApollo("Shanghai", "Rotterdam", { ...hermes, overallRiskScore: 65 })
    ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
  });

  it("does not persist an evaluation when a downstream model returns malformed results", async () => {
    const { getActiveRiskEvents } = await import("./db");
    vi.mocked(getActiveRiskEvents).mockResolvedValue([]);
    vi.mocked(invokeLLM)
      .mockResolvedValueOnce(completion(athena))
      .mockResolvedValueOnce(completion({ ...hermes, overallRiskScore: 1000 }));
    const caller = appRouter.createCaller({
      user: null,
      req: { headers: {} },
      res: {},
    } as TrpcContext);
    await expect(
      caller.routes.evaluate({ origin: "Shanghai", destination: "Rotterdam" })
    ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    expect(insertRouteEvaluation).not.toHaveBeenCalled();
  });
});
