import React from "react"
import { render, screen } from "@testing-library/react"
import TimelineTabContent from "@components/features/independence/TimelineTabContent"
import { RetirementProjection } from "types/independence"

// Accumulation runs 53→56. The CPF RA transfer funds annuitizedValue when the
// user turns 55, but because each row carries END-of-year balances the 0 → >0
// transition lands on the row keyed by the start-of-year age (54). The marker
// must therefore come from the backend's authoritative `cpfLifeAge` (55), NOT
// from the transition row.
function makeProjection(
  overrides: Partial<RetirementProjection> = {},
): RetirementProjection {
  const accum = [53, 54, 55, 56].map((age) => ({
    year: 2000 + age,
    age,
    startingBalance: 100000,
    contribution: 0,
    investmentGrowth: 0,
    endingBalance: 100000,
    // Off-by-one reality: annuity first funds on the age-54 row.
    nonSpendableValue: age >= 54 ? 213000 : 0,
    annuitizedValue: age >= 54 ? 213000 : 0,
    totalWealth: 100000 + (age >= 54 ? 213000 : 0),
    currency: "SGD",
  }))
  return {
    yearlyProjections: [
      {
        age: 65,
        endingBalance: 90000,
        nonSpendableValue: 213000,
        annuitizedValue: 213000,
        totalWealth: 303000,
        currency: "SGD",
      },
    ],
    accumulationProjections: accum,
    cpfLifeAge: 55,
    monthlyExpenses: 3500,
    ...overrides,
  } as unknown as RetirementProjection
}

const baseProps = {
  baselineProjection: null,
  retirementAge: 65,
  lifeExpectancy: 90,
  hideValues: false,
  isCalculating: false,
}

describe("TimelineTabContent — CPF lock note", () => {
  it("shows the statutory CPF LIFE lock age (55) even when the annuity bucket funds on the age-54 row", () => {
    render(<TimelineTabContent projection={makeProjection()} {...baseProps} />)
    const note = screen.getByTestId("cpf-lock-note")
    expect(note).toHaveTextContent(/CPF LIFE/i)
    expect(note).toHaveTextContent(/55/)
    // Must NOT surface the off-by-one transition age.
    expect(note).not.toHaveTextContent(/54/)
  })

  it("omits the note when the backend reports no CPF LIFE lock (cpfLifeAge absent)", () => {
    const noCpf = makeProjection({
      cpfLifeAge: undefined,
    } as unknown as Partial<RetirementProjection>)
    render(<TimelineTabContent projection={noCpf} {...baseProps} />)
    expect(screen.queryByTestId("cpf-lock-note")).not.toBeInTheDocument()
  })
})
