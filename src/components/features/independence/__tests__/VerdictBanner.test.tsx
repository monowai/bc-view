import React from "react"
import { render, screen } from "@testing-library/react"
import VerdictBanner from "../VerdictBanner"
import { Finding } from "types/independence"

describe("VerdictBanner", () => {
  it("renders title and detail text", () => {
    const finding: Finding = {
      code: "OFF_TRACK",
      severity: "WARNING",
      title: "Off track — savings run out at age 89",
      detail: "Exhausted ~1 year before age 90.",
    }
    render(<VerdictBanner finding={finding} />)
    expect(screen.getByText(/savings run out at age 89/i)).toBeInTheDocument()
    expect(screen.getByText(/before age 90/i)).toBeInTheDocument()
  })

  it("applies amber background for WARNING severity", () => {
    const finding: Finding = {
      code: "OFF_TRACK",
      severity: "WARNING",
      title: "T",
      detail: "D",
    }
    const { container } = render(<VerdictBanner finding={finding} />)
    expect(container.firstChild).toHaveClass("bg-amber-50")
  })

  it("applies red background for CRITICAL severity", () => {
    const finding: Finding = {
      code: "CRITICAL_CODE",
      severity: "CRITICAL",
      title: "T",
      detail: "D",
    }
    const { container } = render(<VerdictBanner finding={finding} />)
    expect(container.firstChild).toHaveClass("bg-red-50")
  })

  it("applies green background for POSITIVE severity", () => {
    const finding: Finding = {
      code: "ON_TRACK",
      severity: "POSITIVE",
      title: "T",
      detail: "D",
    }
    const { container } = render(<VerdictBanner finding={finding} />)
    expect(container.firstChild).toHaveClass("bg-green-50")
  })

  it("applies slate background for INFO severity", () => {
    const finding: Finding = {
      code: "INFO_CODE",
      severity: "INFO",
      title: "T",
      detail: "D",
    }
    const { container } = render(<VerdictBanner finding={finding} />)
    expect(container.firstChild).toHaveClass("bg-slate-50")
  })

  it("shows a CTA link for PROFILE_INCOMPLETE finding", () => {
    const finding: Finding = {
      code: "PROFILE_INCOMPLETE",
      severity: "CRITICAL",
      title: "Date of birth not set",
      detail: "Add your date of birth to enable projections.",
    }
    render(<VerdictBanner finding={finding} />)
    const link = screen.getByRole("link", { name: /set date of birth/i })
    expect(link).toHaveAttribute("href", "/independence?view=profile")
  })

  it("renders no CTA link for findings without one", () => {
    const finding: Finding = {
      code: "OFF_TRACK",
      severity: "WARNING",
      title: "Off track",
      detail: "Plan depletes early.",
    }
    render(<VerdictBanner finding={finding} />)
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })

  it("has role=status and aria-label matching the title", () => {
    const finding: Finding = {
      code: "INFO_CODE",
      severity: "INFO",
      title: "Your plan looks healthy",
      detail: "Keep going.",
    }
    render(<VerdictBanner finding={finding} />)
    expect(
      screen.getByRole("status", { name: "Your plan looks healthy" }),
    ).toBeInTheDocument()
  })
})
