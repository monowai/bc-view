/**
 * Deterministic Monte Carlo seed for the Independence report.
 *
 * FNV-1a (32-bit) over `planId + asOfDate`. Same plan on the same as-of
 * date always produces the same seed, so the stress-test section of the
 * report is reproducible. The seed is printed in the report footnote so a
 * reader can re-run it. See bc-claude/INDEPENDENCE_REPORT.md → Determinism.
 */
export function reportSeed(planId: string, asOfDate: string): number {
  const input = `${planId}|${asOfDate}`
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  // Keep it strictly positive: 0 would read as "no seed" downstream.
  return hash === 0 ? 1 : hash
}
