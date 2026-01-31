export interface ParsedSearchInput {
  market: string
  keyword: string
  validMarket: boolean
}

/**
 * Parse "MARKET:KEYWORD" syntax from search input.
 * If the input contains a colon with a valid market prefix, splits into market + keyword.
 * Otherwise returns the full input as the keyword with the default market.
 */
export function parseSearchInput(
  inputValue: string,
  knownMarkets?: string[],
  defaultMarket = "LOCAL",
): ParsedSearchInput {
  const colonIndex = inputValue.indexOf(":")
  if (colonIndex > 0) {
    const prefix = inputValue.substring(0, colonIndex).toUpperCase()
    const keyword = inputValue.substring(colonIndex + 1).trim()
    return {
      market: prefix,
      keyword,
      validMarket: (knownMarkets ?? []).includes(prefix),
    }
  }
  return { market: defaultMarket, keyword: inputValue, validMarket: true }
}
