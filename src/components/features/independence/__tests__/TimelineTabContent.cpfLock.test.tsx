import React from "react"
import { render, screen } from "@testing-library/react"
import TimelineTabContent from "@components/features/independence/TimelineTabContent"
import { RetirementProjection } from "types/independence"

// Minimal projection: accumulation runs 53→56, with the CPF RA transfer
// locking 213k into annuitizedValue at age 55 (0 → >0 transition).
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
    nonSpendableValue: age >= 55 ? 213000 : 0,
    annuitizedValue: age >= 55 ? 213000 : 0,
    totalWealth: 100000 + (age >= 55 ? 213000 : 0),
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
  it("shows the CPF LIFE lock note at the age the annuity bucket first funds", () => {
    render(<TimelineTabContent projection={makeProjection()} {...baseProps} />)
    expect(screen.getByTestId("cpf-lock-note")).toHaveTextContent(/55/)
    expect(screen.getByTestId("cpf-lock-note")).toHaveTextContent(/CPF LIFE/i)
  })

  it("omits the note when there is no CPF annuity (no locked layer)", () => {
    const noCpf = makeProjection({
      accumulationProjections: [53, 54, 55, 56].map((age) => ({
        year: 2000 + age,
        age,
        startingBalance: 100000,
        contribution: 0,
        investmentGrowth: 0,
        endingBalance: 100000,
        nonSpendableValue: 0,
        annuitizedValue: 0,
        totalWealth: 100000,
        currency: "SGD",
      })),
      yearlyProjections: [
        {
          age: 65,
          endingBalance: 90000,
          nonSpendableValue: 0,
          annuitizedValue: 0,
          totalWealth: 90000,
          currency: "SGD",
        },
      ],
    } as unknown as Partial<RetirementProjection>)
    render(<TimelineTabContent projection={noCpf} {...baseProps} />)
    expect(screen.queryByTestId("cpf-lock-note")).not.toBeInTheDocument()
  })
})
