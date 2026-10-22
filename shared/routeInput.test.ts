import { describe, expect, it } from "vitest";
import {
  parseRouteQuery,
  resolveRouteInput,
  routeEvaluationInputSchema,
} from "./routeInput";

describe("route queries", () => {
  it.each([
    [
      "Analyze the risk of shipping electronics from Port of Shanghai to Port of Rotterdam",
      "Port of Shanghai",
      "Port of Rotterdam",
    ],
    [
      "Evaluate route from Port of Shenzhen to Port of Long Beach for semiconductor cargo",
      "Port of Shenzhen",
      "Port of Long Beach",
    ],
    [
      "What is the risk level for shipping from Port of Singapore to Port of Rotterdam?",
      "Port of Singapore",
      "Port of Rotterdam",
    ],
    [
      "Assess the safety of the Hamburg to New York shipping corridor",
      "Hamburg",
      "New York",
    ],
    ["  Toronto to Tokyo  ", "Toronto", "Tokyo"],
  ])("parses the route in %s", (query, origin, destination) => {
    expect(parseRouteQuery(query)).toEqual({ origin, destination });
  });

  it.each([
    "",
    "Tell me about global shipping",
    "from Shanghai",
    "from Shanghai to ",
  ])("leaves incomplete queries for explicit port entry: %s", query => {
    expect(parseRouteQuery(query)).toBeNull();
  });

  it("fills only the missing destination without replacing the explicit origin", () => {
    expect(
      resolveRouteInput({
        origin: "Hamburg",
        destination: "",
        queryText: "from Shanghai to Rotterdam",
      })
    ).toMatchObject({
      success: true,
      data: { origin: "Hamburg", destination: "Rotterdam" },
    });
  });

  it("fills only the missing origin without replacing the explicit destination", () => {
    expect(
      resolveRouteInput({
        origin: "",
        destination: "Hamburg",
        queryText: "from Shanghai to Rotterdam",
      })
    ).toMatchObject({
      success: true,
      data: { origin: "Shanghai", destination: "Hamburg" },
    });
  });

  it("accepts explicit endpoints without requiring natural-language parsing", () => {
    expect(
      resolveRouteInput({
        origin: "  Port of   Shanghai ",
        destination: "Rotterdam",
        queryText: "Analyze weather risk",
      })
    ).toMatchObject({
      success: true,
      data: { origin: "Port of Shanghai", destination: "Rotterdam" },
    });
  });

  it("gives an actionable message when endpoints cannot be determined", () => {
    expect(
      resolveRouteInput({
        origin: "",
        destination: "",
        queryText: "Assess shipping",
      })
    ).toMatchObject({
      success: false,
      message: expect.stringContaining("Enter both ports"),
    });
  });

  it.each([
    { origin: "   ", destination: "Rotterdam" },
    { origin: "Shanghai", destination: "x" },
    { origin: "x".repeat(101), destination: "Rotterdam" },
    {
      origin: "Shanghai",
      destination: "Rotterdam",
      queryText: "x".repeat(2001),
    },
    { origin: "  PORT OF Shanghai ", destination: "shanghai" },
  ])("also rejects invalid direct API inputs: %j", input => {
    expect(routeEvaluationInputSchema.safeParse(input).success).toBe(false);
  });
});
