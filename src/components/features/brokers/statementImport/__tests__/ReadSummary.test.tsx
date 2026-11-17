import React from "react"
import { render, screen } from "@testing-library/react"
import ReadSummary from "../ReadSummary"
import type { ScreenshotProposal } from "types/beancounter"

// A vision model can misread a digit so that the row still agrees with itself
// (110 x 6.07 = 667.70 where the page shows 110 x 8.07 = 887.70). Only the
// page's own total exposes it.
const page: ScreenshotProposal = {
  documentType: "HOLDINGS",
  totalShown: 3887.7,
  rows: [
    { code: "NOK", quantity: 110, price: 8.07, marketValue: 887.7 },
    { code: "KO", quantity: 40, price: 75, marketValue: 3000 },
  ],
}

const GAP = /add up to/

describe("<ReadSummary />", () => {
  test("says nothing more when the rows add up to the total shown", () => {
    render(<ReadSummary proposal={page} />)

    expect(screen.queryByText(GAP)).not.toBeInTheDocument()
  })

  test("says so when the rows do not add up to the total shown", () => {
    const misread = {
      ...page,
      rows: [
        { ...page.rows[0], price: 6.07, marketValue: 667.7 },
        page.rows[1],
      ],
    }

    render(<ReadSummary proposal={misread} />)

    expect(screen.getByRole("status")).toHaveTextContent(
      "The rows add up to 3,667.70, not the 3,887.70 shown. Check each row: one may be misread or cut off.",
    )
  })

  test("allows half a cent of rounding for each row", () => {
    render(<ReadSummary proposal={{ ...page, totalShown: 3887.71 }} />)

    expect(screen.queryByText(GAP)).not.toBeInTheDocument()
  })

  test("checks nothing when there is no total or no market value to add", () => {
    const noTotal = { ...page, totalShown: null }
    const noValues = {
      ...page,
      rows: page.rows.map((row) => ({ ...row, marketValue: null })),
    }

    render(<ReadSummary proposal={noTotal} />)
    render(<ReadSummary proposal={noValues} />)

    expect(screen.queryByText(GAP)).not.toBeInTheDocument()
  })
})
