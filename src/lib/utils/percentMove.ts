/**
 * A price given as a percentage move from the latest close: "7%" or "-7%"
 * is below it, "+7%" above it. A stop loss is the common case, so an
 * unsigned percentage reads as below.
 */
export interface PercentMove {
  pct: number
  above: boolean
}

// Sign (ASCII or Unicode minus), number, percent; spaces allowed between.
const PERCENT_MOVE = /^([+\-−])?\s*(\d+(?:\.\d+)?)\s*%$/

/** The move a text stands for, or null when it is not a percentage. */
export function parsePercentMove(text: string): PercentMove | null {
  const match = PERCENT_MOVE.exec(text.trim())
  if (!match) return null
  return { pct: Number(match[2]), above: match[1] === "+" }
}

/** The price a move from the close lands on, at the asset's price places. */
export function priceFromMove(
  close: number,
  move: PercentMove,
  places: number,
): string {
  const factor = 1 + ((move.above ? 1 : -1) * move.pct) / 100
  return (close * factor).toFixed(places)
}

/** The move in words: "7% below close". */
export function describeMove(move: PercentMove): string {
  return `${move.pct}% ${move.above ? "above" : "below"} close`
}
