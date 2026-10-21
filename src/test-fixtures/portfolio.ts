import { NetWorth, Portfolio } from "types/beancounter"
import { USD } from "./asset"

export function makePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: "p-1",
    code: "TEST",
    name: "Test Portfolio",
    currency: USD,
    base: USD,
    marketValue: 15000,
    irr: 0.1,
    ...overrides,
  } as Portfolio
}

export function makeNetWorth(overrides: Partial<NetWorth> = {}): NetWorth {
  return {
    asAt: "2026-10-09",
    currency: "USD",
    totalValue: 150000,
    holdingsValue: 150000,
    standaloneCompositeValue: 0,
    healthcareReserve: 0,
    gainOnDay: 0,
    portfolioCount: 2,
    classificationBreakdown: [
      { classification: "Investment", value: 100000, percentage: 66.67 },
      { classification: "Cash", value: 50000, percentage: 33.33 },
    ],
    portfolios: [
      {
        id: "pf-1",
        code: "ALPHA",
        name: "Alpha Portfolio",
        value: 100000,
        percentage: 66.67,
        irr: 0.05,
      },
      {
        id: "pf-2",
        code: "BETA",
        name: "Beta Portfolio",
        value: 50000,
        percentage: 33.33,
        irr: 0.03,
      },
    ],
    ...overrides,
  }
}
