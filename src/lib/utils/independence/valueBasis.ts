import { ValueBasis } from "types/independence"

/**
 * Fallback inflation treatment per income-stream key, used ONLY when the
 * backend response omits `valueBasis` (older svc-retire builds). When
 * `valueBasis` IS present the flag MUST come from it — this map is never
 * consulted in that case. Mirrors the documented svc-retire defaults so
 * the UI degrades gracefully instead of going silent.
 *
 * Keep in sync with the backend's income-stream definitions; the backend
 * is the source of truth once it ships `valueBasis`.
 */
const FALLBACK_INFLATION_INDEXED: Readonly<Record<string, boolean>> = {
  investmentReturns: false,
  pension: false,
  assetPensions: true,
  socialSecurity: true,
  otherIncome: false,
  rentalIncome: true,
}

/**
 * Resolve whether a given income stream is inflation-indexed.
 *
 * - When `valueBasis` is present, the answer comes from its `incomeStreams`
 *   flags (backend drives display data). Returns `undefined` for a stream
 *   the backend didn't describe.
 * - When `valueBasis` is absent (older backend), falls back to the known
 *   default map. Returns `undefined` for an unrecognised key.
 *
 * `undefined` means "unknown" — callers should render no indexation tag
 * rather than guess.
 */
export function isStreamInflationIndexed(
  valueBasis: ValueBasis | undefined,
  key: string,
): boolean | undefined {
  if (valueBasis) {
    const stream = valueBasis.incomeStreams.find((s) => s.key === key)
    return stream?.inflationIndexed
  }
  return FALLBACK_INFLATION_INDEXED[key]
}
