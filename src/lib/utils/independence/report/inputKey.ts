/**
 * JSON with object keys sorted, so two inputs with equal content produce the
 * same key however their records were built. The report containers key their
 * one seeded simulation run on it.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) =>
            a.localeCompare(b, "en-US"),
          ),
        )
      : v,
  )
}
