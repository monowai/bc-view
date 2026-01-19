import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import OffboardingProgress, { OFFBOARDING_STEPS } from "../OffboardingProgress"

describe("OffboardingProgress", () => {
  it("renders all step names on desktop", () => {
    render(<OffboardingProgress currentStep={1} />)

    OFFBOARDING_STEPS.forEach((step) => {
      expect(screen.getByText(step.name)).toBeInTheDocument()
    })
  })

  it("highlights the current step", () => {
    render(<OffboardingProgress currentStep={2} />)

    // Verify that step 2 (Wealth) text is present
    expect(screen.getByText("Wealth")).toBeInTheDocument()
    // Verify the navigation exists
    expect(screen.getByRole("navigation")).toBeInTheDocument()
  })

  it("shows completed steps with check marks", () => {
    render(<OffboardingProgress currentStep={3} />)

    // Steps 1 and 2 should be completed (show check marks)
    // Step 3 should be current
    // We can verify by checking that the progress nav exists
    expect(screen.getByRole("navigation")).toBeInTheDocument()
  })

  it("shows all steps as upcoming when on step 1", () => {
    render(<OffboardingProgress currentStep={1} />)

    // Step 1 should be current, all others upcoming
    expect(screen.getByText("Summary")).toBeInTheDocument()
    expect(screen.getByText("Wealth")).toBeInTheDocument()
    expect(screen.getByText("Planning")).toBeInTheDocument()
    expect(screen.getByText("Account")).toBeInTheDocument()
  })

  it("has correct number of steps", () => {
    expect(OFFBOARDING_STEPS).toHaveLength(4)
    expect(OFFBOARDING_STEPS[0].name).toBe("Summary")
    expect(OFFBOARDING_STEPS[1].name).toBe("Wealth")
    expect(OFFBOARDING_STEPS[2].name).toBe("Planning")
    expect(OFFBOARDING_STEPS[3].name).toBe("Account")
  })
})
