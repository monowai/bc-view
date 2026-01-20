/**
 * Parse shorthand amounts: 4k = 4000, 4m = 4000000, 1h = 100
 * Supports decimals: 2.5k = 2500
 */
export const parseShorthandAmount = (input: string): number => {
  const trimmed = input.trim().toLowerCase()
  const match = trimmed.match(/^([\d.]+)([hmk])?$/)
  if (!match) return parseFloat(input) || 0

  const num = parseFloat(match[1])
  const suffix = match[2]

  switch (suffix) {
    case "h":
      return num * 100
    case "k":
      return num * 1000
    case "m":
      return num * 1000000
    default:
      return num
  }
}

/**
 * Check if an input string contains shorthand notation
 */
export const hasShorthandSuffix = (input: string): boolean => {
  return /[hkm]/i.test(input)
}
