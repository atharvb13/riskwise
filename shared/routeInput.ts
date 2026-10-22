import { z } from "zod";

const portName = z
  .string()
  .trim()
  .transform(value => value.replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(2, "Port names must contain at least 2 characters.")
      .max(100, "Port names must be 100 characters or fewer.")
  );

const portIdentity = (name: string) =>
  name.toLowerCase().replace(/^port\s+(?:of\s+)?/, "");

export const routeEvaluationInputSchema = z
  .object({
    origin: portName,
    destination: portName,
    queryText: z
      .string()
      .trim()
      .max(2000, "Keep the route query under 2,000 characters.")
      .optional(),
  })
  .refine(
    input => portIdentity(input.origin) !== portIdentity(input.destination),
    {
      message: "Choose different origin and destination ports.",
      path: ["destination"],
    }
  );

export type RouteInput = z.input<typeof routeEvaluationInputSchema>;

/** Parse the supported from/to and corridor forms, without treating letters in port names as separators. */
export function parseRouteQuery(
  query: string
): { origin: string; destination: string } | null {
  const cleaned = query
    .trim()
    .replace(/[?.!]+$/, "")
    .trim();
  const match =
    cleaned.match(/\bfrom\s+(.+?)\s+to\s+(.+)$/i) ??
    cleaned.match(
      /\bof\s+(?:the\s+)?(.+?)\s+to\s+(.+?)\s+(?:shipping\s+)?corridor$/i
    ) ??
    cleaned.match(/^(.+?)\s+to\s+(.+)$/i);
  if (!match) return null;
  const origin = match[1].trim();
  const destination = match[2]
    .replace(/\s+(?:for|next|with|carrying|during)\b.*$/i, "")
    .replace(/\s+(?:shipping\s+)?corridor$/i, "")
    .trim();
  return origin && destination ? { origin, destination } : null;
}

/** Explicit form fields win; a query only supplies the missing endpoints. */
export function resolveRouteInput(
  input: RouteInput
):
  | { success: true; data: z.output<typeof routeEvaluationInputSchema> }
  | { success: false; message: string } {
  let origin = input.origin.trim();
  let destination = input.destination.trim();
  if (!origin || !destination) {
    const parsed = parseRouteQuery(input.queryText ?? "");
    origin ||= parsed?.origin ?? "";
    destination ||= parsed?.destination ?? "";
  }
  if (!origin || !destination) {
    return {
      success: false,
      message:
        "Enter both ports, or use a query such as “from Shanghai to Rotterdam”.",
    };
  }
  const result = routeEvaluationInputSchema.safeParse({
    ...input,
    origin,
    destination,
  });
  return result.success
    ? { success: true, data: result.data }
    : { success: false, message: result.error.issues[0].message };
}
