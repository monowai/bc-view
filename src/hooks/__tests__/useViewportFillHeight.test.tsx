import React from "react"
import { act, render, screen } from "@testing-library/react"
import { useViewportFillHeight } from "@hooks/useViewportFillHeight"

const GAP = 24

function Region(): React.ReactElement {
  const { ref, maxHeight } = useViewportFillHeight<HTMLDivElement>(GAP)
  return <div ref={ref} data-testid="region" style={{ maxHeight }} />
}

function place(top: number, viewport: number, scrollY = 0): void {
  jest
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockReturnValue({ top: top - scrollY } as DOMRect)
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: viewport,
  })
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value: scrollY,
  })
}

describe("useViewportFillHeight", () => {
  let observed: ResizeObserverCallback

  beforeEach(() => {
    global.ResizeObserver = jest.fn((callback: ResizeObserverCallback) => {
      observed = callback
      return { observe: jest.fn(), disconnect: jest.fn(), unobserve: jest.fn() }
    }) as unknown as typeof ResizeObserver
  })

  afterEach(() => jest.restoreAllMocks())

  it("ends the region the gap above the window bottom", () => {
    place(300, 1000)
    render(<Region />)
    expect(screen.getByTestId("region")).toHaveStyle({ maxHeight: "676px" })
  })

  it("measures from the document, so page scroll does not change the height", () => {
    place(300, 1000, 120)
    render(<Region />)
    expect(screen.getByTestId("region")).toHaveStyle({ maxHeight: "676px" })
  })

  it("remeasures when the window resizes", () => {
    place(300, 1000)
    render(<Region />)
    place(300, 800)
    act(() => {
      window.dispatchEvent(new Event("resize"))
    })
    expect(screen.getByTestId("region")).toHaveStyle({ maxHeight: "476px" })
  })

  it("remeasures when content above pushes the region down", () => {
    place(300, 1000)
    render(<Region />)
    place(360, 1000)
    act(() => observed([], {} as ResizeObserver))
    expect(screen.getByTestId("region")).toHaveStyle({ maxHeight: "616px" })
  })

  it("still measures where the browser has no ResizeObserver", () => {
    Reflect.deleteProperty(global, "ResizeObserver")
    place(300, 1000)
    render(<Region />)
    expect(screen.getByTestId("region")).toHaveStyle({ maxHeight: "676px" })
  })

  it("keeps a usable height in a short window", () => {
    place(300, 400)
    render(<Region />)
    expect(screen.getByTestId("region")).toHaveStyle({ maxHeight: "240px" })
  })
})
