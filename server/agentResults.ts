import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { InvokeResult } from "./_core/llm";

const text = z.string().trim().min(1);
const score = z.number().min(0).max(100);
const transitDays = z.number().int().positive().max(365);
const category = z.enum([
  "Weather",
  "Strike",
  "Geopolitical",
  "Port Congestion",
]);
const severity = z.enum(["Low", "Medium", "High", "Critical"]);

export const athenaResultSchema = z.object({
  relevantDisruptions: z
    .array(
      z.object({
        title: text,
        category,
        severity,
        affectedLocations: z.array(text),
        impactSummary: text,
      })
    )
    .max(30),
  intelligenceSummary: text,
});

export const hermesResultSchema = z.object({
  overallRiskScore: score,
  primaryRiskFactor: text,
  breakdown: z.object({
    weather: score,
    labor: score,
    geopolitical: score,
    congestion: score,
  }),
  riskNarrative: text,
  baseTransitDays: transitDays,
});

export const apolloResultSchema = z.object({
  alternativeRoutes: z
    .array(
      z.object({
        name: text,
        transitDays,
        riskScore: score,
        waypoints: z
          .array(
            z.tuple([
              z.number().min(-180).max(180),
              z.number().min(-90).max(90),
            ])
          )
          .min(2)
          .max(64),
        costImpact: text,
        description: text,
      })
    )
    .max(5),
  recommendation: text,
});

export const athenaScanSchema = z.object({
  title: text.max(255),
  description: text,
  category,
  severity,
  affectedLocations: z.array(text).min(1),
});

/** Validate untrusted model output before it reaches another agent or the DB. */
export function parseAgentResult<T>(
  schema: z.ZodType<T>,
  response: InvokeResult,
  agent: string
): T {
  try {
    const content = response.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim())
      throw new Error("Empty result");
    const json = content
      .trim()
      .replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, "$1");
    return schema.parse(JSON.parse(json));
  } catch {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `${agent} returned an invalid analysis. Please retry the evaluation.`,
    });
  }
}
