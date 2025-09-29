// Shared test utilities for GrandTotal tests
import React from "react"
import { render } from "@testing-library/react"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import GrandTotal from "../GrandTotal"
import { mockHoldings } from "../__mocks__/testData"

export interface GrandTotalRenderOptions {
  holdings?: typeof mockHoldings
  valueIn?: ValueIn
}

export const renderGrandTotal = (
  options: GrandTotalRenderOptions = {},
): ReturnType<typeof render> => {
  const { holdings = mockHoldings, valueIn = ValueIn.PORTFOLIO } = options

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
