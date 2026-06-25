import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import CompositeAssetEditor from "../CompositeAssetEditor"

/**
 * Regression: a fresh CPF asset must default to the STANDARD CPF LIFE plan
 * because svc-retire's pension enrichment only emits a non-zero monthly
 * payout when the plan is set. An unset plan silently zeroes the projection.
 */
describe("CompositeAssetEditor — CPF LIFE plan default", () => {
  it("seeds STANDARD when policy turns CPF and the plan is empty", () => {
    const onPolicyTypeChange = jest.fn()
    const onCpfLifePlanChange = jest.fn()
    render(
      <CompositeAssetEditor
        policyType={undefined}
        lockedUntilDate=""
        subAccounts={[]}
        cpfLifePlan={undefined}
        onPolicyTypeChange={onPolicyTypeChange}
        onLockedUntilDateChange={jest.fn()}
        onSubAccountsChange={jest.fn()}
        onCpfLifePlanChange={onCpfLifePlanChange}
        onCpfPayoutStartAgeChange={jest.fn()}
      />,
    )
    // Policy-type select is the first <select> in the editor. The label
    // is a sibling <label> without htmlFor, so we target by role + order.
    const policySelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement
    fireEvent.change(policySelect, { target: { value: "CPF" } })
    expect(onPolicyTypeChange).toHaveBeenCalledWith("CPF")
    expect(onCpfLifePlanChange).toHaveBeenCalledWith("STANDARD")
  })

  it("does NOT overwrite an existing CPF LIFE plan when policy changes to CPF", () => {
    const onCpfLifePlanChange = jest.fn()
    render(
      <CompositeAssetEditor
        policyType={undefined}
        lockedUntilDate=""
        subAccounts={[]}
        cpfLifePlan="BASIC"
        onPolicyTypeChange={jest.fn()}
        onLockedUntilDateChange={jest.fn()}
        onSubAccountsChange={jest.fn()}
        onCpfLifePlanChange={onCpfLifePlanChange}
        onCpfPayoutStartAgeChange={jest.fn()}
      />,
    )
    // Policy-type select is the first <select> in the editor. The label
    // is a sibling <label> without htmlFor, so we target by role + order.
    const policySelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement
    fireEvent.change(policySelect, { target: { value: "CPF" } })
    expect(onCpfLifePlanChange).not.toHaveBeenCalled()
  })

  it("auto-applies the OA/SA/MA/RA template when policy turns CPF with no sub-accounts", () => {
    const onSubAccountsChange = jest.fn()
    render(
      <CompositeAssetEditor
        policyType={undefined}
        lockedUntilDate=""
        subAccounts={[]}
        cpfLifePlan={undefined}
        onPolicyTypeChange={jest.fn()}
        onLockedUntilDateChange={jest.fn()}
        onSubAccountsChange={onSubAccountsChange}
        onCpfLifePlanChange={jest.fn()}
        onCpfPayoutStartAgeChange={jest.fn()}
      />,
    )
    const policySelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement
    fireEvent.change(policySelect, { target: { value: "CPF" } })
    expect(onSubAccountsChange).toHaveBeenCalled()
    const applied = onSubAccountsChange.mock.calls[0][0] as { code: string }[]
    expect(applied.map((a) => a.code)).toEqual(["OA", "SA", "MA", "RA"])
  })

  it("resets sub-accounts and clears the CPF LIFE plan when switching away from CPF", () => {
    const onSubAccountsChange = jest.fn()
    const onCpfLifePlanChange = jest.fn()
    render(
      <CompositeAssetEditor
        policyType="CPF"
        lockedUntilDate=""
        subAccounts={[
          { code: "OA", balance: 1000, liquid: true },
          { code: "MA", balance: 500, liquid: false },
        ]}
        cpfLifePlan="STANDARD"
        onPolicyTypeChange={jest.fn()}
        onLockedUntilDateChange={jest.fn()}
        onSubAccountsChange={onSubAccountsChange}
        onCpfLifePlanChange={onCpfLifePlanChange}
        onCpfPayoutStartAgeChange={jest.fn()}
      />,
    )
    const policySelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement
    fireEvent.change(policySelect, { target: { value: "ILP" } })
    // Template resets to the new type's default (empty) and CPF-only state clears.
    expect(onSubAccountsChange).toHaveBeenCalledWith([])
    expect(onCpfLifePlanChange).toHaveBeenCalledWith(undefined)
  })

  it("does not render a Liquid checkbox — liquidity is template-driven, not user-chosen", () => {
    render(
      <CompositeAssetEditor
        policyType="CPF"
        lockedUntilDate=""
        subAccounts={[
          { code: "OA", balance: 0, liquid: true },
          { code: "MA", balance: 0, liquid: false },
        ]}
        cpfLifePlan="STANDARD"
        onPolicyTypeChange={jest.fn()}
        onLockedUntilDateChange={jest.fn()}
        onSubAccountsChange={jest.fn()}
        onCpfLifePlanChange={jest.fn()}
        onCpfPayoutStartAgeChange={jest.fn()}
      />,
    )
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    expect(screen.queryByText(/^Liquid$/)).not.toBeInTheDocument()
  })

  it("evaluates a math expression in a bucket balance via MathInput", () => {
    const onSubAccountsChange = jest.fn()
    render(
      <CompositeAssetEditor
        policyType="CPF"
        lockedUntilDate=""
        subAccounts={[{ code: "OA", balance: 0, liquid: true }]}
        cpfLifePlan="STANDARD"
        onPolicyTypeChange={jest.fn()}
        onLockedUntilDateChange={jest.fn()}
        onSubAccountsChange={onSubAccountsChange}
        onCpfLifePlanChange={jest.fn()}
        onCpfPayoutStartAgeChange={jest.fn()}
      />,
    )
    const balance = screen.getByLabelText(/OA balance/i)
    fireEvent.change(balance, { target: { value: "1k*2" } })
    fireEvent.blur(balance)
    // MathInput expands shorthand + evaluates: 1k*2 -> 2000.
    expect(onSubAccountsChange).toHaveBeenCalledWith([
      { code: "OA", balance: 2000, liquid: true },
    ])
  })

  it("hides the locked-date picker and the add-sub-account row for CPF", () => {
    render(
      <CompositeAssetEditor
        policyType="CPF"
        lockedUntilDate=""
        subAccounts={[
          { code: "OA", balance: 0, liquid: true },
          { code: "MA", balance: 0, liquid: false },
        ]}
        cpfLifePlan="STANDARD"
        onPolicyTypeChange={jest.fn()}
        onLockedUntilDateChange={jest.fn()}
        onSubAccountsChange={jest.fn()}
        onCpfLifePlanChange={jest.fn()}
        onCpfPayoutStartAgeChange={jest.fn()}
      />,
    )
    // CPF is statutorily locked → no manual lock date prompt.
    expect(screen.queryByText(/Locked Until Date/i)).not.toBeInTheDocument()
    // CPF sub-accounts are fixed → no "add code" affordance.
    expect(
      screen.queryByPlaceholderText(/Sub-account code/i),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: /^Add$/i }),
    ).not.toBeInTheDocument()
  })
})
