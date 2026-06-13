import React from "react"
import { render, screen } from "@testing-library/react"
import MarketingLanding from "../MarketingLanding"

describe("MarketingLanding", () => {
  it("renders the hero headline and sign-in call to action", () => {
    render(<MarketingLanding />)
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /your whole financial picture/i,
      }),
    ).toBeInTheDocument()
    const signIn = screen.getByRole("link", { name: /^sign in$/i })
    expect(signIn).toHaveAttribute("href", "/auth/login")
  })

  it("explains all three pillars with their questions", () => {
    render(<MarketingLanding />)
    expect(
      screen.getByRole("heading", { name: /see everything you own/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: /work becomes optional/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: /a model you can hold to/i }),
    ).toBeInTheDocument()
    expect(screen.getByText("What do I have?")).toBeInTheDocument()
    expect(screen.getByText("What do I want?")).toBeInTheDocument()
    expect(screen.getByText("How do I get there?")).toBeInTheDocument()
  })

  it("links each pillar to its learn page", () => {
    render(<MarketingLanding />)
    const learnLinks = screen.getAllByRole("link", { name: /learn more/i })
    const hrefs = learnLinks.map((l) => l.getAttribute("href"))
    expect(hrefs).toEqual([
      "/learn/wealth",
      "/learn/independence",
      "/learn/strategy",
    ])
  })

  it("labels the illustrative figures so charts are not read as real data", () => {
    render(<MarketingLanding />)
    expect(
      screen.getByText(/figures shown throughout are illustrative/i),
    ).toBeInTheDocument()
  })

  it("exposes each chart as a labelled image for assistive tech", () => {
    render(<MarketingLanding />)
    // Three pillar charts plus the hero chart.
    expect(screen.getAllByRole("img").length).toBe(4)
    expect(
      screen.getByRole("img", { name: /net-worth chart climbing/i }),
    ).toBeInTheDocument()
  })
})
