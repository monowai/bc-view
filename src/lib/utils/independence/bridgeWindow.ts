/**
 * The "bridge window" is the stretch of retirement funded from liquid assets
 * alone, before deferred guaranteed income (Social Security / CPF LIFE) begins.
 *
 * The backend reports `fiMetrics.bridgeToAge` — the age that income starts. When
 * it lands after the independence age, the years between are self-funded and the
 * timeline shades them + marks where the income kicks in. When income already
 * flows from independence (bridgeToAge <= retirementAge, or either is unknown),
 * there is no gap to show.
 */
export interface BridgeWindow {
  /** Whether to render the shaded gap + income-start marker. */
  show: boolean
  /** Start of the self-funded window (independence age). */
  fromAge: number | null
  /** End of the window = age guaranteed income begins. */
  toAge: number | null
}

export function deriveBridgeWindow(opts: {
  bridgeToAge?: number | null
  retirementAge?: number | null
}): BridgeWindow {
  const { bridgeToAge, retirementAge } = opts
  const show =
    bridgeToAge != null && retirementAge != null && bridgeToAge > retirementAge
  return {
    show,
    fromAge: show ? (retirementAge ?? null) : null,
    toAge: show ? (bridgeToAge ?? null) : null,
  }
}
