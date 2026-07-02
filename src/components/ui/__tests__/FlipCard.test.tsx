import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import FlipCard from "../FlipCard"

function renderFlipCard(
  overrides: Partial<React.ComponentProps<typeof FlipCard>> = {},
): void {
  render(
    <FlipCard
      front={<div>Front content</div>}
      back={<div>Back content</div>}
      frontLabel="Phases"
      backLabel="Narrative"
      {...overrides}
    />,
  )
}

describe("FlipCard", () => {
  it("renders front content and hides back on initial render", () => {
    renderFlipCard()
    expect(screen.getByText("Front content")).toBeInTheDocument()
    expect(screen.getByText("Back content")).toBeInTheDocument()

    // Back face is in the DOM but aria-hidden
    const backFace = screen.getByText("Back content").closest("[aria-hidden]")
    expect(backFace).toHaveAttribute("aria-hidden", "true")

    // Front face is NOT aria-hidden
    const frontFace = screen.getByText("Front content").parentElement
    expect(frontFace).not.toHaveAttribute("aria-hidden")
  })

  it("shows the 'Narrative' toggle button on front face initially", () => {
    renderFlipCard()
    expect(
      screen.getByRole("button", { name: /Show Narrative/i }),
    ).toBeInTheDocument()
  })

  it("shows the 'Phases' back button once flipped", async () => {
    const user = userEvent.setup()
    renderFlipCard()

    await user.click(screen.getByRole("button", { name: /Show Narrative/i }))

    expect(
      screen.getByRole("button", { name: /Show Phases/i }),
    ).toBeInTheDocument()
  })

  it("flips: front becomes aria-hidden after clicking the forward toggle", async () => {
    const user = userEvent.setup()
    renderFlipCard()

    await user.click(screen.getByRole("button", { name: /Show Narrative/i }))

    const frontFace = screen.getByText("Front content").closest("[aria-hidden]")
    expect(frontFace).toHaveAttribute("aria-hidden", "true")

    // Back face is no longer aria-hidden
    const backFace = screen.getByText("Back content").parentElement
    expect(backFace).not.toHaveAttribute("aria-hidden")
  })

  it("flips back: front recovers when back button is clicked", async () => {
    const user = userEvent.setup()
    renderFlipCard()

    await user.click(screen.getByRole("button", { name: /Show Narrative/i }))
    await user.click(screen.getByRole("button", { name: /Show Phases/i }))

    // Front should be visible again (not aria-hidden)
    const frontFace = screen.getByText("Front content").parentElement
    expect(frontFace).not.toHaveAttribute("aria-hidden")

    // Back should be aria-hidden again
    const backFace = screen.getByText("Back content").closest("[aria-hidden]")
    expect(backFace).toHaveAttribute("aria-hidden", "true")
  })

  it("renders custom front and back labels in toggle buttons", () => {
    renderFlipCard({ frontLabel: "Config", backLabel: "Notes" })

    expect(
      screen.getByRole("button", { name: /Show Notes/i }),
    ).toBeInTheDocument()
  })

  it("shows back label button on front face and front label button on back face", async () => {
    const user = userEvent.setup()
    renderFlipCard({ frontLabel: "Config", backLabel: "Notes" })

    // Initially: forward button visible ("Show Notes")
    expect(screen.getByRole("button", { name: /Show Notes/i })).toBeVisible()

    // After flip: back button visible ("Show Config")
    await user.click(screen.getByRole("button", { name: /Show Notes/i }))
    expect(
      screen.getByRole("button", { name: /Show Config/i }),
    ).toBeInTheDocument()
  })
})
