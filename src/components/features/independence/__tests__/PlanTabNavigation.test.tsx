import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import PlanTabNavigation from "../PlanTabNavigation"

const noop = (): void => {}

describe("PlanTabNavigation", () => {
  it("offers the two reading sections and Set up", () => {
    render(
      <PlanTabNavigation activeTab="standing" onTabChange={noop} hasAssets />,
    )
    expect(
      screen.getByRole("button", { name: /Where you stand/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Your path/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Set up/ })).toBeInTheDocument()
  })

  it("marks the active section for assistive tech, not just colour", () => {
    render(<PlanTabNavigation activeTab="path" onTabChange={noop} hasAssets />)
    expect(screen.getByRole("button", { name: /Your path/ })).toHaveAttribute(
      "aria-current",
      "page",
    )
    expect(
      screen.getByRole("button", { name: /Where you stand/ }),
    ).not.toHaveAttribute("aria-current")
  })

  it("explains what the current section answers", () => {
    render(
      <PlanTabNavigation activeTab="standing" onTabChange={noop} hasAssets />,
    )
    expect(
      screen.getByText(/What this stage is worth today/),
    ).toBeInTheDocument()
  })

  it("disables Your path until there are assets to chart", async () => {
    const onTabChange = jest.fn()
    render(
      <PlanTabNavigation
        activeTab="standing"
        onTabChange={onTabChange}
        hasAssets={false}
      />,
    )
    const path = screen.getByRole("button", { name: /Your path/ })
    expect(path).toBeDisabled()
    await userEvent.click(path)
    expect(onTabChange).not.toHaveBeenCalled()
  })

  it("keeps Set up reachable with no assets — it is where assets get chosen", () => {
    render(
      <PlanTabNavigation
        activeTab="standing"
        onTabChange={noop}
        hasAssets={false}
      />,
    )
    expect(screen.getByRole("button", { name: /Set up/ })).toBeEnabled()
  })

  it("switches section on click", async () => {
    const onTabChange = jest.fn()
    render(
      <PlanTabNavigation
        activeTab="standing"
        onTabChange={onTabChange}
        hasAssets
      />,
    )
    await userEvent.click(screen.getByRole("button", { name: /Set up/ }))
    expect(onTabChange).toHaveBeenCalledWith("setup")
  })
})
