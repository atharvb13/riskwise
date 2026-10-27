import { describe, expect, it } from "vitest";
import { PORTS, findPort, getPortCoordinates, portIdentity } from "./ports";
import { routeEvaluationInputSchema } from "./routeInput";

describe("shared port catalog", () => {
  it("resolves every declared name, code and alias to the same identity", () => {
    expect(new Set(PORTS.map(port => port.id)).size).toBe(PORTS.length);
    for (const port of PORTS) {
      for (const alias of [port.id, port.name, ...port.aliases]) {
        expect(
          findPort(`  ${alias.toUpperCase().replaceAll(" ", "   ")} `)
        ).toBe(port);
        expect(getPortCoordinates(alias)).toEqual(port.coordinates);
      }
      expect(port.coordinates[0]).toBeGreaterThanOrEqual(-180);
      expect(port.coordinates[0]).toBeLessThanOrEqual(180);
      expect(port.coordinates[1]).toBeGreaterThanOrEqual(-90);
      expect(port.coordinates[1]).toBeLessThanOrEqual(90);
    }
  });

  it("canonicalizes names before they reach model prompts and persistence", () => {
    expect(
      routeEvaluationInputSchema.parse({
        origin: "cn sha",
        destination: "Pusan",
      })
    ).toEqual({ origin: "Port of Shanghai", destination: "Port of Busan" });
  });

  it("keeps adjacent ports and named terminals distinct", () => {
    expect(portIdentity("Los Angeles")).not.toBe(portIdentity("Long Beach"));
    expect(portIdentity("Shanghai")).not.toBe(portIdentity("Yangshan"));
    expect(portIdentity("Rotterdam")).not.toBe(portIdentity("Europoort"));
    expect(portIdentity("Dubai")).not.toBe(portIdentity("Jebel Ali"));
  });

  it.each([
    "Unknown Harbor",
    "Shanghai to Rotterdam",
    "__proto__",
    "constructor",
    "",
  ])("does not guess coordinates for %s", name => {
    expect(findPort(name)).toBeUndefined();
    expect(getPortCoordinates(name)).toBeNull();
  });

  it("retains ports outside the catalog as text without inventing a location", () => {
    expect(
      routeEvaluationInputSchema.parse({
        origin: "Unknown Harbor",
        destination: "Shanghai",
      })
    ).toEqual({ origin: "Unknown Harbor", destination: "Port of Shanghai" });
  });

  it("does not expose mutable catalog coordinates", () => {
    const coordinates = getPortCoordinates("Shanghai")!;
    coordinates[0] = 0;
    expect(getPortCoordinates("Shanghai")).toEqual([121.8, 30.6]);
  });
});
