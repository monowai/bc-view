import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { portfoliosKey } from "@utils/api/client/portfolios"
import type { Portfolio } from "types/beancounter"

/** The portfolios an import can be recorded in: the active ones. */
export function useActivePortfolios(): {
  portfolios: Portfolio[]
  error: Error | undefined
} {
  const { data, error } = useSwr<{ data: Portfolio[] }, Error>(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )
  const portfolios = (data?.data ?? []).filter(
    (portfolio) => portfolio.active !== false,
  )
  return { portfolios, error }
}

/** How a portfolio is named in a list. */
export const portfolioLabel = (
  portfolio: Pick<Portfolio, "name" | "code">,
): string => `${portfolio.name} (${portfolio.code})`
