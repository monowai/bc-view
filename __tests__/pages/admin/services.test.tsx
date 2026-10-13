import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { ServiceCard } from "@pages/admin/services"

const upHealth = { status: "UP" }

describe("admin services ServiceCard", () => {
  it("renders the public link as an external anchor when the service has one", () => {
    render(
      <ServiceCard
        service={{
          name: "waharoa",
          url: "http://waharoa:4000",
          link: "https://waharoa.monowai.com",
          health: upHealth,
          info: { build: { version: "1.83.3" } },
          error: null,
          responseTimeMs: 12,
        }}
      />,
    )

    const anchor = screen.getByRole("link", {
      name: /waharoa\.monowai\.com/,
    })
    expect(anchor).toHaveAttribute("href", "https://waharoa.monowai.com")
    expect(anchor).toHaveAttribute("target", "_blank")
    expect(anchor).toHaveAttribute("rel", expect.stringContaining("noopener"))
    expect(screen.queryByText("http://waharoa:4000")).not.toBeInTheDocument()
    expect(screen.getByText("1.83.3")).toBeInTheDocument()
  })

  it("shows the probed address as plain text when there is no public link", () => {
    render(
      <ServiceCard
        service={{
          name: "bc-data",
          url: "http://bc-data/api",
          health: upHealth,
          info: null,
          error: null,
          responseTimeMs: 5,
        }}
      />,
    )

    expect(screen.getByText("http://bc-data/api")).toBeInTheDocument()
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
})
