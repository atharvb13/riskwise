import { eq, and, asc, desc, gt, lte, or, inArray, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { EVENT_FRESHNESS_MS, observedTimestamp, safeSourceUrl } from "@shared/intelligence";
import type { LiveRiskEvent } from "./realtime";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  type InsertRiskEvent,
  type InsertShippingRoute,
  type InsertRouteEvaluation,
  riskEvents,
  routeEvaluations,
  shippingRoutes,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _client: ReturnType<typeof postgres> | null = null;

function getDb() {
  if (!_db) {
    _client = postgres(ENV.DATABASE_URL);
    _db = drizzle(_client);
  }
  return _db;
}

/** Release the pool when the application or an isolated integration run ends. */
export async function closeDb() {
  const client = _client;
  _db = null;
  _client = null;
  await client?.end({ timeout: 5 });
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function getUserById(id: number) {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getUserByEmail(email: string) {
  const db = getDb();
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0] ?? null;
}

// ── Risk Events ───────────────────────────────────────────────────────────────

export async function getActiveRiskEvents() {
  const db = getDb();
  return db
    .select()
    .from(riskEvents)
    .where(and(eq(riskEvents.isActive, true), inArray(riskEvents.sourceKind, ["live", "baseline"]), gt(riskEvents.lastSeenAt, new Date(Date.now() - EVENT_FRESHNESS_MS))))
    .orderBy(desc(riskEvents.createdAt));
}

export async function insertRiskEvent(event: InsertRiskEvent) {
  const db = getDb();
  return db.insert(riskEvents).values(event);
}

/** Atomically refresh observations by source identity, preserving first-seen time. */
export async function refreshRiskEvents(events: LiveRiskEvent[], now = new Date()) {
  return getDb().transaction(async transaction => {
    const [lock] = await transaction.execute(sql`SELECT pg_try_advisory_xact_lock(824013, 1) AS locked`);
    if (!lock.locked) return { skipped: true, stored: 0, expired: 0 };
    const cutoff = new Date(now.getTime() - EVENT_FRESHNESS_MS);
    let stored = 0;
    for (const event of events) {
      const fetched = observedTimestamp(event.fetchedAt);
      if (!fetched || !event.title.trim() || !event.sourceProvider.trim() || !event.sourceEventId.trim()) continue;
      const lastSeenAt = new Date(Math.min(now.getTime(), Date.parse(fetched)));
      if (lastSeenAt <= cutoff) continue;
      const fingerprint = createHash("sha256").update(JSON.stringify([event.sourceKind, event.sourceProvider.trim().toLowerCase(), event.sourceEventId.trim()])).digest("hex");
      const observed = observedTimestamp(event.observedAt);
      const values = {
        title: event.title.trim().slice(0, 255), description: event.description,
        category: event.category, severity: event.severity, affectedLocations: event.affectedLocations,
        sourceUrl: safeSourceUrl(event.sourceUrl), sourceKind: event.sourceKind,
        sourceProvider: event.sourceProvider, sourceEventId: event.sourceEventId, fingerprint,
        observedAt: observed ? new Date(observed) : null, lastSeenAt, isActive: true,
      };
      const rows = await transaction.insert(riskEvents).values(values).onConflictDoUpdate({
        target: riskEvents.fingerprint, set: values,
        setWhere: lte(riskEvents.lastSeenAt, lastSeenAt),
      }).returning({ id: riskEvents.id });
      stored += rows.length;
    }
    const expired = await transaction.update(riskEvents).set({ isActive: false })
      .where(and(eq(riskEvents.isActive, true), or(lte(riskEvents.lastSeenAt, cutoff), eq(riskEvents.sourceKind, "legacy"))))
      .returning({ id: riskEvents.id });
    return { skipped: false, stored, expired: expired.length };
  });
}

// ── Shipping Routes ───────────────────────────────────────────────────────────

export async function getAllShippingRoutes() {
  const db = getDb();
  return db.select().from(shippingRoutes).orderBy(desc(shippingRoutes.createdAt));
}

export async function findRoute(origin: string, destination: string) {
  const db = getDb();
  const results = await db
    .select()
    .from(shippingRoutes)
    .where(and(eq(shippingRoutes.originPort, origin), eq(shippingRoutes.destinationPort, destination)))
    .limit(1);
  return results[0] ?? null;
}

export async function insertShippingRoute(route: InsertShippingRoute) {
  const db = getDb();
  return db.insert(shippingRoutes).values(route);
}

// ── Route Evaluations ─────────────────────────────────────────────────────────

export async function insertRouteEvaluation(evaluation: InsertRouteEvaluation) {
  const db = getDb();
  return db.insert(routeEvaluations).values(evaluation);
}

export async function getRouteHistory(limit = 20) {
  const db = getDb();
  return db
    .select()
    .from(routeEvaluations)
    .orderBy(desc(routeEvaluations.evaluatedAt))
    .limit(limit);
}

export async function getRouteTrend(originPort: string, destinationPort: string, limit = 10) {
  const db = getDb();
  return db
    .select({
      id: routeEvaluations.id,
      overallRiskScore: routeEvaluations.overallRiskScore,
      evaluatedAt: routeEvaluations.evaluatedAt,
    })
    .from(routeEvaluations)
    .where(
      and(
        eq(routeEvaluations.originPort, originPort),
        eq(routeEvaluations.destinationPort, destinationPort)
      )
    )
    .orderBy(asc(routeEvaluations.evaluatedAt))
    .limit(limit);
}

export async function getEvaluationById(id: number) {
  const db = getDb();
  const results = await db
    .select()
    .from(routeEvaluations)
    .where(eq(routeEvaluations.id, id))
    .limit(1);
  return results[0] ?? null;
}
