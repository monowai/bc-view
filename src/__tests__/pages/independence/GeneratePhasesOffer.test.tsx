import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import GeneratePhasesOffer from "@components/features/independence/GeneratePhasesOffer"
import type { RetirementPlan } from "types/independence"

const mockPlan: RetirementPlan = {
  id: "plan-1",
  name: "Test Plan",
  monthlyExpenses: 5000,
  planningHorizonYears: 30,
  equityReturnRate: 0.07,
  expensesCurrency: "SGD",
  isPrimary: true,
} as RetirementPlan

describe("GeneratePhasesOffer", () => {
  it("renders heading and description", () => {
    render(
      <GeneratePhasesOffer
        plan={mockPlan}
        onGenerate={jest.fn()}
        isLoading={false}
      />,
    )

    expect(
      screen.getByText("Plan your retirement in phases"),
    ).toBeInTheDocument()
    expect(screen.getByText(/go-go/i)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /generate phased plans/i }),
    ).toBeInTheDocument()
  })

  it("calls onGenerate when button is clicked", async () => {
    const onGenerate = jest.fn().mockResolvedValue(undefined)
    render(
      <GeneratePhasesOffer
        plan={mockPlan}
        onGenerate={onGenerate}
        isLoading={false}
      />,
    )

    await userEvent.click(
      screen.getByRole("button", { name: /generate phased plans/i }),
    )

    expect(onGenerate).toHaveBeenCalledTimes(1)
  })

  it("shows spinner and disables button when isLoading is true", () => {
    render(
      <GeneratePhasesOffer
        plan={mockPlan}
        onGenerate={jest.fn()}
        isLoading={true}
      />,
    )

    const button = screen.getByRole("button")
    expect(button).toBeDisabled()
    expect(screen.getByText("Generating...")).toBeInTheDocument()
  })
})
