import React from "react"
import { render, screen } from "@testing-library/react"
import PlanFindingsCard from "../PlanFindingsCard"
import { Finding } from "types/independence"

describe("PlanFindingsCard", () => {
  it("renders nothing when there are no findings", () => {
    const { container } = render(<PlanFindingsCard findings={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders findings with titles and details", () => {
    const findings: Finding[] = [
      {
        code: "OFF_TRACK",
        severity: "WARNING",
        title: "Off track — savings run out at age 89",
        detail: "Exhausted ~1 year before age 90.",
      },
    ]
    render(<PlanFindingsCard findings={findings} />)
    expect(screen.getByText(/savings run out at age 89/i)).toBeInTheDocument()
    expect(screen.getByText(/before age 90/i)).toBeInTheDocument()
  })

  it("shows a CTA for the profile-incomplete finding", () => {
    const findings: Finding[] = [
      {
        code: "PROFILE_INCOMPLETE",
        severity: "CRITICAL",
        title: "Date of birth not set",
        detail: "Add your date of birth.",
      },
    ]
    render(<PlanFindingsCard findings={findings} />)
    const link = screen.getByRole("link", { name: /set date of birth/i })
    expect(link).toHaveAttribute("href", "/independence?view=profile")
  })
})
