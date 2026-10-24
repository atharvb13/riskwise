import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAllRealTimeIntelligence } from "./realtime";

afterEach(() => vi.unstubAllGlobals());

const rss = `<rss><channel><item><title>Port shipping delay near Taiwan</title><link>https://news.example/story</link><pubDate>Sat, 24 Oct 2026 08:00:00 GMT</pubDate><description>Storm conditions are causing significant shipping delays in the Taiwan Strait.</description></item></channel></rss>`;

function mockFeeds(news = rss) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      if (input.includes("eonet"))
        return Response.json({
          events: [
            {
              id: "EONET_1",
              title: "Pacific storm",
              categories: [{ id: "severeStorms", title: "Severe Storms" }],
              geometry: [
                { date: "2026-10-24T07:00:00Z", coordinates: [125, 25] },
              ],
              sources: [{ url: "https://weather.example/storm" }],
            },
          ],
        });
      if (input.includes("usgs"))
        return Response.json({
          features: [
            {
              id: "us_1",
              properties: {
                mag: 6.2,
                place: "Japan",
                time: Date.parse("2026-10-24T06:00:00Z"),
                url: "https://earthquake.usgs.gov/earthquakes/eventpage/us_1",
              },
              geometry: { coordinates: [135, 30] },
            },
          ],
        });
      return new Response(
        input.includes("bbci") ? news : "<rss><channel></channel></rss>"
      );
    })
  );
}

describe("intelligence provenance", () => {
  it("does not merge distinct source events just because their title prefixes match", async () => {
    const prefix = "Port shipping disruption ".repeat(4);
    mockFeeds(
      rss
        .replace("Port shipping delay near Taiwan", prefix + "first")
        .replace(
          "</channel>",
          `<item><title>${prefix}second</title><link>https://news.example/second</link></item></channel>`
        )
    );
    const summary = await fetchAllRealTimeIntelligence();
    expect(
      summary.events.filter(event => event.sourceProvider === "BBC World")
    ).toHaveLength(2);
  });
  it("preserves stable source identities, evidence links and source observation times", async () => {
    mockFeeds();
    const summary = await fetchAllRealTimeIntelligence();
    expect(
      summary.events.find(event => event.sourceProvider === "BBC World")
    ).toMatchObject({
      sourceKind: "live",
      sourceEventId: "https://news.example/story",
      sourceUrl: "https://news.example/story",
      observedAt: "2026-10-24T08:00:00.000Z",
    });
    expect(
      summary.events.find(event => event.sourceProvider === "NASA EONET")
    ).toMatchObject({
      sourceEventId: "EONET_1",
      sourceKind: "live",
      observedAt: "2026-10-24T07:00:00.000Z",
    });
    expect(
      summary.events.find(
        event => event.sourceProvider === "USGS Earthquake Hazards"
      )
    ).toMatchObject({
      sourceEventId: "us_1",
      sourceKind: "live",
      observedAt: "2026-10-24T06:00:00.000Z",
    });
  });

  it("marks bundled country values as static context with no invented observation timestamp", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    const summary = await fetchAllRealTimeIntelligence();
    expect(summary.events.length).toBeGreaterThan(0);
    expect(
      summary.events.every(
        event => event.sourceKind === "baseline" && event.observedAt === null
      )
    ).toBe(true);
    expect(summary.events[0].description).toContain("not a live observation");
    expect(
      summary.sources.find(source => source.sourceKind === "baseline")
    ).toMatchObject({ name: "RiskWise static baseline", ok: true });
    expect(
      summary.sources
        .filter(source => source.sourceKind === "live")
        .every(source => !source.ok)
    ).toBe(true);
  });

  it("treats a reachable empty RSS feed as healthy rather than a failed fetch", async () => {
    mockFeeds("<rss><channel></channel></rss>");
    const summary = await fetchAllRealTimeIntelligence();
    expect(
      summary.sources.find(source => source.name.startsWith("RSS"))
    ).toMatchObject({ ok: true, count: 0, sourceKind: "live" });
  });

  it("does not preserve script URLs supplied by a feed", async () => {
    mockFeeds(rss.replace("https://news.example/story", "javascript:alert(1)"));
    const summary = await fetchAllRealTimeIntelligence();
    expect(
      summary.events.find(event => event.sourceProvider === "BBC World")
        ?.sourceUrl
    ).toBeUndefined();
  });
});
