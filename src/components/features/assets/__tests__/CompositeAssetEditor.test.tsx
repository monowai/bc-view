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

  it("seeds STANDARD when Apply CPF Template is clicked with no plan set", () => {
    const onCpfLifePlanChange = jest.fn()
    const onSubAccountsChange = jest.fn()
    render(
      <CompositeAssetEditor
        policyType="CPF"
        lockedUntilDate=""
        subAccounts={[]}
        cpfLifePlan={undefined}
        onPolicyTypeChange={jest.fn()}
        onLockedUntilDateChange={jest.fn()}
        onSubAccountsChange={onSubAccountsChange}
        onCpfLifePlanChange={onCpfLifePlanChange}
        onCpfPayoutStartAgeChange={jest.fn()}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /Apply CPF Template/i }))
    expect(onSubAccountsChange).toHaveBeenCalled()
    expect(onCpfLifePlanChange).toHaveBeenCalledWith("STANDARD")
  })
})
