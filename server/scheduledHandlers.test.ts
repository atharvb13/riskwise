import { beforeEach, expect, it, vi } from "vitest";
import type { DataFetchSummary } from "./realtime";

vi.mock("./agents", () => ({ runAthenaScan: vi.fn() }));
vi.mock("./db", () => ({ refreshRiskEvents: vi.fn() }));
import { runAthenaScan } from "./agents";
import { refreshRiskEvents } from "./db";
import { athenaHourlyScan } from "./scheduledHandlers";

const empty: DataFetchSummary = {
  events: [],
  sources: [],
  fetchedAt: new Date().toISOString(),
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(refreshRiskEvents).mockResolvedValue({
    skipped: false,
    stored: 0,
    expired: 0,
  });
});

it("coalesces concurrent startup, cron and manual triggers into one scan", async () => {
  let resolve!: (summary: DataFetchSummary) => void;
  vi.mocked(runAthenaScan).mockReturnValue(
    new Promise(done => {
      resolve = done;
    })
  );
  const first = athenaHourlyScan();
  const second = athenaHourlyScan();
  expect(second).toBe(first);
  expect(runAthenaScan).toHaveBeenCalledTimes(1);
  resolve(empty);
  await Promise.all([first, second]);
  expect(refreshRiskEvents).toHaveBeenCalledTimes(1);
});

it("allows the next scan after a collection failure", async () => {
  vi.mocked(runAthenaScan)
    .mockRejectedValueOnce(new Error("Feed failure"))
    .mockResolvedValue(empty);
  await expect(athenaHourlyScan()).rejects.toThrow("Feed failure");
  await expect(athenaHourlyScan()).resolves.toBeUndefined();
  expect(refreshRiskEvents).toHaveBeenCalledTimes(1);
});

it("allows the next scan after a database refresh failure", async () => {
  vi.mocked(runAthenaScan).mockResolvedValue(empty);
  vi.mocked(refreshRiskEvents).mockRejectedValueOnce(
    new Error("Database failure")
  );
  await expect(athenaHourlyScan()).rejects.toThrow("Database failure");
  await expect(athenaHourlyScan()).resolves.toBeUndefined();
  expect(refreshRiskEvents).toHaveBeenCalledTimes(2);
});
