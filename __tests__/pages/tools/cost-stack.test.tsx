import React from "react"
import { render, screen } from "@testing-library/react"
import CostStackPage from "@pages/tools/cost-stack"

jest.mock("next/router", () => ({
  useRouter: () => ({ pathname: "/tools/cost-stack" }),
}))

describe("/tools/cost-stack", () => {
  it("renders the playground iframe pointing at the public asset", () => {
    const { container } = render(<CostStackPage />)
    const iframe = container.querySelector("iframe")
    expect(iframe).not.toBeNull()
    expect(iframe).toHaveAttribute("src", "/tools/cost-stack.html")
    expect(iframe).toHaveAttribute("title")
  })

  it("renders a Sign In CTA so unauth visitors funnel back to login", () => {
    render(<CostStackPage />)
    const cta = screen.getByRole("link", { name: /Sign In/i })
    expect(cta).toHaveAttribute("href", "/auth/login")
  })

  it("renders a heading explaining what the page is", () => {
    render(<CostStackPage />)
    expect(
      screen.getByRole("heading", { name: /Cost Stack|Fee Impact/i }),
    ).toBeInTheDocument()
  })
})
