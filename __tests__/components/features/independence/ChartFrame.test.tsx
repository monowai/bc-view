import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import { beforeEach, describe, it } from "@jest/globals"
import { ChartFrame } from "@components/features/independence/ChartFrame"

// Recharts' ResponsiveContainer measures the DOM and renders nothing in jsdom,
// so stub it to render its child directly.
jest.mock("recharts", () => ({
  __esModule: true,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive">{children}</div>
  ),
}))

// Stand-in for a rendered Recharts chart: exposes the .recharts-wrapper node
// that the dismiss logic targets, plus a spy for the synthesised mouseleave.
function FakeChart({ onLeave }: { onLeave: () => void }): React.ReactElement {
  return (
    <div
      className="recharts-wrapper"
      data-testid="wrapper"
      onMouseLeave={onLeave}
    >
      <span data-testid="point">point</span>
    </div>
  )
}

describe("ChartFrame", () => {
  let onLeave: jest.Mock

  beforeEach(() => {
    onLeave = jest.fn()
  })

  it("applies the default responsive height around the chart", () => {
    render(
      <ChartFrame>
        <FakeChart onLeave={onLeave} />
      </ChartFrame>,
    )
    const wrapper = screen.getByTestId("wrapper")
    const frame = wrapper.closest("div.h-56")
    expect(frame).toHaveClass("h-56", "sm:h-72", "lg:h-80")
  })

  it("honours a custom heightClass", () => {
    render(
      <ChartFrame heightClass="h-40 md:h-64">
        <FakeChart onLeave={onLeave} />
      </ChartFrame>,
    )
    expect(screen.getByTestId("wrapper").closest("div.h-40")).toHaveClass(
      "h-40",
      "md:h-64",
    )
  })

  it("dismisses the tooltip when the user taps outside the chart", () => {
    render(
      <ChartFrame>
        <FakeChart onLeave={onLeave} />
      </ChartFrame>,
    )
    fireEvent.touchStart(document.body)
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it("leaves the tooltip alone when the tap is inside the chart", () => {
    render(
      <ChartFrame>
        <FakeChart onLeave={onLeave} />
      </ChartFrame>,
    )
    fireEvent.touchStart(screen.getByTestId("point"))
    expect(onLeave).not.toHaveBeenCalled()
  })

  it("dismisses the tooltip on viewport resize", () => {
    render(
      <ChartFrame>
        <FakeChart onLeave={onLeave} />
      </ChartFrame>,
    )
    fireEvent(window, new Event("resize"))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it("dismisses the tooltip on orientation change", () => {
    render(
      <ChartFrame>
        <FakeChart onLeave={onLeave} />
      </ChartFrame>,
    )
    fireEvent(window, new Event("orientationchange"))
    expect(onLeave).toHaveBeenCalledTimes(1)
  })
})
