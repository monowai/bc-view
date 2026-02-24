import "./testSetup"
import { renderGrandTotal, getDataCells } from "./testHelpers"

describe("GrandTotal Structure Validation", () => {
  it("validates table structure and cell count", () => {
    const { container } = renderGrandTotal()

    const dataRow = container.querySelector("tbody tr:last-child")
    const cells = dataRow?.querySelectorAll("td")

    // Validate basic structure
    expect(cells).toHaveLength(14) // 1 label + 1 spacer + 12 data cells

    // Validate first cell is the value title
    expect(cells![0]).toHaveTextContent("Value in PORTFOLIO")

    // Validate second cell is empty spacer
    expect(cells![1]).toHaveTextContent("")
    expect(cells![1]).toHaveAttribute("colSpan", "1")

    // Validate data cells exist and have expected structure
    const dataCells = getDataCells(container)
    expect(dataCells).toHaveLength(12)

    // Validate specific known values are present
    expect(dataCells.some((cell) => cell.textContent?.includes("72.76"))).toBe(
      true,
    ) // gainOnDay
    expect(
      dataCells.some((cell) => cell.textContent?.includes("8,150.65")),
    ).toBe(true) // costValue
    expect(
      dataCells.some((cell) => cell.textContent?.includes("4,284.31")),
    ).toBe(true) // totalGain
  })
})
