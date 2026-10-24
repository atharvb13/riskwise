import { describe, expect, it } from "vitest";
import {
  observedTimestamp,
  safeSourceUrl,
  sourceKindLabel,
} from "./intelligence";

describe("evidence metadata", () => {
  it.each([
    undefined,
    "",
    "javascript:alert(1)",
    "data:text/html,test",
    "/relative",
    "https://user:password@example.com",
  ])("rejects unsafe evidence links: %s", value => {
    expect(safeSourceUrl(value)).toBeNull();
  });
  it("retains ordinary web evidence links", () => {
    expect(safeSourceUrl(" https://example.com/article ")).toBe(
      "https://example.com/article"
    );
  });
  it("does not convert missing observation timestamps to the current time", () => {
    for (const value of [null, undefined, "", "invalid"])
      expect(observedTimestamp(value)).toBeNull();
    expect(observedTimestamp(0)).toBe("1970-01-01T00:00:00.000Z");
  });
  it("distinguishes live, baseline and unverified historic records", () => {
    expect(sourceKindLabel("live")).toBe("Live observation");
    expect(sourceKindLabel("baseline")).toBe("Static baseline");
    expect(sourceKindLabel(undefined)).toBe("Unverified record");
  });
});
