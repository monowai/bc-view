import React from "react"

export type SortDirection = "asc" | "desc"

export interface SortConfig {
  key: string | null
  direction: SortDirection
}

interface SortIconTheme {
  inactive: string
  active: string
  ascChar: string
  descChar: string
  neutralChar: string
}

const themes: Record<string, SortIconTheme> = {
  default: {
    inactive: "text-gray-400",
    active: "text-blue-500",
    ascChar: "↑",
    descChar: "↓",
    neutralChar: "↕",
  },
  wealth: {
    inactive: "text-wealth-200/60",
    active: "text-white font-bold",
    ascChar: "↑",
    descChar: "↓",
    neutralChar: "↕",
  },
  holdings: {
    inactive: "text-blue-300 text-xs",
    active: "text-blue-800 font-bold",
    ascChar: "▲",
    descChar: "▼",
    neutralChar: "↕",
  },
}

export function getSortIcon(
  headerKey: string,
  sortConfig: SortConfig | undefined | null,
  theme: keyof typeof themes = "default",
): React.ReactElement {
  const t = themes[theme] || themes.default
  if (!sortConfig || sortConfig.key !== headerKey) {
    return <span className={`ml-1 ${t.inactive}`}>{t.neutralChar}</span>
  }
  return sortConfig.direction === "asc" ? (
    <span className={`ml-1 ${t.active}`}>{t.ascChar}</span>
  ) : (
    <span className={`ml-1 ${t.active}`}>{t.descChar}</span>
  )
}
