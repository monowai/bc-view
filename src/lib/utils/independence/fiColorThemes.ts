/**
 * Shared color themes for Financial Independence (FIRE) progress indicators.
 * Single source of truth for FI progress color schemes across components.
 */

/**
 * FI Progress thresholds for color determination.
 */
export const FI_PROGRESS_THRESHOLDS = {
  /** FI achieved - 100% or more */
  FI_ACHIEVED: 100,
  /** High progress - 75% or more */
  HIGH: 75,
  /** Medium progress - 50% or more */
  MEDIUM: 50,
  /** Low progress - below 50% */
  LOW: 0,
} as const

/**
 * Color scheme for a progress level.
 */
export interface ProgressColorScheme {
  /** Background color class (e.g., for progress bars) */
  bg: string
  /** Text color class (e.g., for percentage display) */
  text: string
  /** Light background for containers */
  bgLight: string
  /** Border color for containers */
  border: string
}

/**
 * Color schemes for each FI progress level.
 */
export const FI_PROGRESS_COLORS: Record<
  "FI_ACHIEVED" | "HIGH" | "MEDIUM" | "LOW",
  ProgressColorScheme
> = {
  FI_ACHIEVED: {
    bg: "bg-green-500",
    text: "text-green-600",
    bgLight: "bg-green-50",
    border: "border-green-200",
  },
  HIGH: {
    bg: "bg-blue-500",
    text: "text-blue-600",
    bgLight: "bg-blue-50",
    border: "border-blue-200",
  },
  MEDIUM: {
    bg: "bg-yellow-500",
    text: "text-yellow-600",
    bgLight: "bg-yellow-50",
    border: "border-yellow-200",
  },
  LOW: {
    bg: "bg-orange-500",
    text: "text-orange-600",
    bgLight: "bg-orange-50",
    border: "border-orange-200",
  },
} as const

/**
 * Get the appropriate color scheme based on FI progress percentage.
 * @param progress FI progress percentage (0-100+)
 * @returns Color scheme for the progress level
 */
export function getProgressColorScheme(progress: number): ProgressColorScheme {
  if (progress >= FI_PROGRESS_THRESHOLDS.FI_ACHIEVED) {
    return FI_PROGRESS_COLORS.FI_ACHIEVED
  }
  if (progress >= FI_PROGRESS_THRESHOLDS.HIGH) {
    return FI_PROGRESS_COLORS.HIGH
  }
  if (progress >= FI_PROGRESS_THRESHOLDS.MEDIUM) {
    return FI_PROGRESS_COLORS.MEDIUM
  }
  return FI_PROGRESS_COLORS.LOW
}

/**
 * Get the background color class for a progress bar.
 * @param progress FI progress percentage
 * @returns Tailwind background color class
 */
export function getProgressBgColor(progress: number): string {
  return getProgressColorScheme(progress).bg
}

/**
 * Get the text color class for progress display.
 * @param progress FI progress percentage
 * @returns Tailwind text color class
 */
export function getProgressTextColor(progress: number): string {
  return getProgressColorScheme(progress).text
}

/**
 * Gap to FI color scheme (different from progress - shows gap/surplus).
 */
export const GAP_TO_FI_COLORS = {
  /** FI achieved (surplus) - gap is negative */
  SURPLUS: {
    text: "text-green-600",
    bg: "bg-green-50",
    icon: "fa-check-circle text-green-500",
  },
  /** Gap remaining - gap is positive */
  GAP: {
    text: "text-orange-600",
    bg: "bg-gray-50",
    icon: "fa-arrow-up text-orange-400",
  },
} as const

/**
 * Get the color scheme for Gap to FI display.
 * @param gapToFi Gap to FI (positive = gap, negative = surplus)
 * @returns Color scheme for gap display
 */
export function getGapColorScheme(
  gapToFi: number,
): (typeof GAP_TO_FI_COLORS)["SURPLUS" | "GAP"] {
  return gapToFi <= 0 ? GAP_TO_FI_COLORS.SURPLUS : GAP_TO_FI_COLORS.GAP
}

/**
 * Savings rate color thresholds.
 */
export const SAVINGS_RATE_COLORS = {
  /** Excellent savings rate - 50% or more */
  EXCELLENT: { threshold: 50, text: "text-green-600" },
  /** Good savings rate - 20% or more */
  GOOD: { threshold: 20, text: "text-blue-600" },
  /** Low savings rate - below 20% */
  LOW: { threshold: 0, text: "text-gray-900" },
} as const

/**
 * Get text color class based on savings rate.
 * @param savingsRate Savings rate percentage
 * @returns Tailwind text color class
 */
export function getSavingsRateTextColor(savingsRate: number): string {
  if (savingsRate >= SAVINGS_RATE_COLORS.EXCELLENT.threshold) {
    return SAVINGS_RATE_COLORS.EXCELLENT.text
  }
  if (savingsRate >= SAVINGS_RATE_COLORS.GOOD.threshold) {
    return SAVINGS_RATE_COLORS.GOOD.text
  }
  return SAVINGS_RATE_COLORS.LOW.text
}
