import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import GroupBar from "../GroupBar"
import { makeHoldingGroup } from "@test-fixtures/beancounter"
import { ValueIn } from "@components/features/holdings/GroupByOptions"

const renderGroupBar = (
  props: Partial<React.ComponentProps<typeof GroupBar>> = {},
): ReturnType<typeof render> => {
  const group = makeHoldingGroup({ subTotals: { marketValue: 25200 } })
  return render(
    <table>
      <GroupBar
        groupBy="Equity"
        subTotals={group.subTotals}
        valueIn={ValueIn.PORTFOLIO}
        positionCount={6}
        isCollapsed={false}
        onToggleCollapse={jest.fn()}
        stickyTop={30}
        {...props}
      />
    </table>,
  )
}

describe("GroupBar", () => {
  it("shows the group name and holding count", () => {
    renderGroupBar()
    expect(screen.getByText("Equity")).toBeInTheDocument()
    expect(screen.getByText("6 holdings")).toBeInTheDocument()
  })

  it("singularises the holding count for one position", () => {
    renderGroupBar({ positionCount: 1 })
    expect(screen.getByText("1 holding")).toBeInTheDocument()
  })

  it("hides subtotal figures when expanded (SubTotal footer shows them instead)", () => {
    renderGroupBar({ isCollapsed: false })
    expect(screen.queryByText("25,200")).not.toBeInTheDocument()
  })

  it("surfaces the section subtotals inline when collapsed", () => {
    renderGroupBar({ isCollapsed: true })
    // Market value subtotal is visible without expanding the section
    expect(screen.getByText("25,200")).toBeInTheDocument()
  })

  it("toggles collapse when the row is clicked", () => {
    const onToggleCollapse = jest.fn()
    renderGroupBar({ onToggleCollapse })
    fireEvent.click(screen.getByText("Equity"))
    expect(onToggleCollapse).toHaveBeenCalledTimes(1)
  })

  it("pins beneath the column header via the sticky offset", () => {
    const { container } = renderGroupBar({ stickyTop: 42 })
    const row = container.querySelector("tr.holding-group-bar") as HTMLElement
    expect(row).toBeTruthy()
    expect(row.style.position).toBe("sticky")
    expect(row.style.top).toBe("42px")
  })
})
