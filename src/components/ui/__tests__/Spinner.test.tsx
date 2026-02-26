import React from "react"
import { render, screen } from "@testing-library/react"
import Spinner from "../Spinner"

describe("Spinner", () => {
  it("renders with default sm size", () => {
    const { container } = render(<Spinner />)
    const span = container.querySelector("span")
    expect(span).toHaveClass("text-sm")
    expect(container.querySelector("i")).toHaveClass("fas", "fa-spinner", "fa-spin")
  })

  it("renders label text", () => {
    render(<Spinner label="Loading..." />)
    expect(screen.getByText("Loading...")).toBeInTheDocument()
  })

  it("adds mr-2 to icon when label is present", () => {
    const { container } = render(<Spinner label="Loading..." />)
    expect(container.querySelector("i")).toHaveClass("mr-2")
  })

  it("does not add mr-2 when no label", () => {
    const { container } = render(<Spinner />)
    const icon = container.querySelector("i")
    expect(icon?.className).not.toContain("mr-2")
  })

  it.each([
    ["sm", "text-sm"],
    ["md", "text-base"],
    ["lg", "text-lg"],
    ["xl", "text-xl"],
    ["2xl", "text-2xl"],
    ["3xl", "text-3xl"],
    ["4xl", "text-4xl"],
  ] as const)("renders size %s with class %s", (size, expectedClass) => {
    const { container } = render(<Spinner size={size} />)
    expect(container.querySelector("span")).toHaveClass(expectedClass)
  })

  it("applies custom className", () => {
    const { container } = render(<Spinner className="text-gray-400 mb-2" />)
    const span = container.querySelector("span")
    expect(span).toHaveClass("text-gray-400", "mb-2")
  })
})
