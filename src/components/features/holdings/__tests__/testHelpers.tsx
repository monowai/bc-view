// Shared test utilities for GrandTotal tests
import React from "react"
import { render } from "@testing-library/react"
import { Holdings } from "types/beancounter"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import GrandTotal from "../GrandTotal"
import { makeHoldings, makePortfolio } from "@test-fixtures/beancounter"

/**
 * Default Holdings used by GrandTotal tests. viewTotals values come from
 * `TEST_VALUES` in `../constants.ts` so assertions and fixture stay in sync.
 */
export const grandTotalHoldings = (
  overrides: Parameters<typeof makeHoldings>[0] = {},
): Holdings =>
  makeHoldings({
    portfolio: makePortfolio({ id: "test-portfolio", marketValue: 12643.74 }),
    viewTotals: {
      gainOnDay: 72.76,
      costValue: 8150.65,
      marketValue: 12643.74,
      dividends: 299.02,
      unrealisedGain: 3503.85,
      realisedGain: 481.44,
      irr: 0.15,
      weight: 1.0,
      totalGain: 4284.31,
      averageCost: 45.28,
    },
    totals: {
      marketValue: 12643.74,
      purchases: 8150.65,
      sales: 0,
      cash: 0,
      income: 299.02,
      gain: 4284.31,
      irr: 0.15,
    },
    ...overrides,
  })

export interface GrandTotalRenderOptions {
  holdings?: Holdings
  valueIn?: ValueIn
}

export const renderGrandTotal = (
  options: GrandTotalRenderOptions = {},
): ReturnType<typeof render> => {
  const { holdings = grandTotalHoldings(), valueIn = ValueIn.PORTFOLIO } =
    options

  return render(
    <table>
      <GrandTotal holdings={holdings} valueIn={valueIn} />
    </table>,
  )
}

export const getDataCells = (container: HTMLElement): Element[] => {
  const dataRow = container.querySelector("tbody tr:last-child")
  const cells = dataRow?.querySelectorAll("td")
  return Array.from(cells!).slice(2) // Skip label and spacer cells
}

export const getCellByPosition = (
  container: HTMLElement,
  position: number,
): Element => {
  const dataCells = getDataCells(container)
  return dataCells[position]
}

// Common test patterns
export const expectCellContent = (
  container: HTMLElement,
  position: number,
  expectedContent: string | RegExp,
): void => {
  const cell = getCellByPosition(container, position)
  if (typeof expectedContent === "string") {
    expect(cell).toHaveTextContent(expectedContent)
  } else {
    expect(cell.textContent).toMatch(expectedContent)
  }
}

export const expectCellVisibility = (
  container: HTMLElement,
  position: number,
  isVisible: boolean,
): void => {
  const cell = getCellByPosition(container, position)
  if (isVisible) {
    expect(cell).not.toHaveClass("hidden")
  } else {
    expect(cell).toHaveClass("hidden")
  }
}
