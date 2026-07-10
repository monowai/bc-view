import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import CompositeAssetEditor from "../CompositeAssetEditor"
import { makeSubAccount } from "@test-fixtures/beancounter"

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
          makeSubAccount({ code: "OA", balance: 1000 }),
          makeSubAccount({ code: "MA", balance: 500, liquid: false }),
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
          makeSubAccount({ code: "OA" }),
          makeSubAccount({ code: "MA", liquid: false }),
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
        subAccounts={[makeSubAccount({ code: "OA" })]}
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
      makeSubAccount({ code: "OA", balance: 2000 }),
    ])
  })

  it("hides the locked-date picker and the add-sub-account row for CPF", () => {
    render(
      <CompositeAssetEditor
        policyType="CPF"
        lockedUntilDate=""
        subAccounts={[
          makeSubAccount({ code: "OA" }),
          makeSubAccount({ code: "MA", liquid: false }),
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

/**
 * US 401(k)/IRA + UK ISA wrapper support (#1087). Mirrors the CPF pattern:
 * selecting the policy type applies a single-account template and, for
 * US wrappers, defaults tax treatment to TRADITIONAL (svc-retire projects
 * net-of-tax for TRADITIONAL, 1:1 for ROTH/TAX_FREE).
 */
describe("CompositeAssetEditor — US 401(k)/IRA + UK ISA wrappers", () => {
  const baseProps = {
    lockedUntilDate: "",
    subAccounts: [],
    onPolicyTypeChange: jest.fn(),
    onLockedUntilDateChange: jest.fn(),
    onSubAccountsChange: jest.fn(),
    onCpfLifePlanChange: jest.fn(),
    onCpfPayoutStartAgeChange: jest.fn(),
  }

  it("seeds a single Balance sub-account and defaults TRADITIONAL when policy turns US_401K", () => {
    const onPolicyTypeChange = jest.fn()
    const onSubAccountsChange = jest.fn()
    const onTaxTreatmentChange = jest.fn()
    render(
      <CompositeAssetEditor
        {...baseProps}
        policyType={undefined}
        taxTreatment={undefined}
        onPolicyTypeChange={onPolicyTypeChange}
        onSubAccountsChange={onSubAccountsChange}
        onTaxTreatmentChange={onTaxTreatmentChange}
      />,
    )
    const policySelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement
    fireEvent.change(policySelect, { target: { value: "US_401K" } })
    expect(onPolicyTypeChange).toHaveBeenCalledWith("US_401K")
    const applied = onSubAccountsChange.mock.calls[0][0] as { code: string }[]
    expect(applied.map((a) => a.code)).toEqual(["BAL"])
    expect(onTaxTreatmentChange).toHaveBeenCalledWith("TRADITIONAL")
  })

  it("shows Traditional/Roth toggle + match fields for US_401K, and hides withdrawal tax rate for Roth", () => {
    const { rerender } = render(
      <CompositeAssetEditor
        {...baseProps}
        policyType="US_401K"
        taxTreatment="TRADITIONAL"
      />,
    )
    expect(
      screen.getByRole("radio", { name: /Traditional/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: /Roth/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/Employee Deferral/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Employer Match %/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Match Cap/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Withdrawal Tax Rate/i)).toBeInTheDocument()

    rerender(
      <CompositeAssetEditor
        {...baseProps}
        policyType="US_401K"
        taxTreatment="ROTH"
      />,
    )
    expect(
      screen.queryByLabelText(/Withdrawal Tax Rate/i),
    ).not.toBeInTheDocument()
  })

  it("submits deferral/match/cap as decimals from percent input", () => {
    const onEmployeeDeferralPercentChange = jest.fn()
    const onEmployerMatchPercentChange = jest.fn()
    const onEmployerMatchCapPercentChange = jest.fn()
    render(
      <CompositeAssetEditor
        {...baseProps}
        policyType="US_401K"
        taxTreatment="TRADITIONAL"
        onEmployeeDeferralPercentChange={onEmployeeDeferralPercentChange}
        onEmployerMatchPercentChange={onEmployerMatchPercentChange}
        onEmployerMatchCapPercentChange={onEmployerMatchCapPercentChange}
      />,
    )
    fireEvent.change(screen.getByLabelText(/Employee Deferral/i), {
      target: { value: "6" },
    })
    expect(onEmployeeDeferralPercentChange).toHaveBeenCalledWith(0.06)

    fireEvent.change(screen.getByLabelText(/Employer Match %/i), {
      target: { value: "3" },
    })
    expect(onEmployerMatchPercentChange).toHaveBeenCalledWith(0.03)

    fireEvent.change(screen.getByLabelText(/Match Cap/i), {
      target: { value: "6" },
    })
    expect(onEmployerMatchCapPercentChange).toHaveBeenCalledWith(0.06)
  })

  it("seeds a single Balance sub-account and forces TAX_FREE (hidden) for UK_ISA — no tax fields shown", () => {
    const onSubAccountsChange = jest.fn()
    const onTaxTreatmentChange = jest.fn()
    render(
      <CompositeAssetEditor
        {...baseProps}
        policyType={undefined}
        onSubAccountsChange={onSubAccountsChange}
        onTaxTreatmentChange={onTaxTreatmentChange}
      />,
    )
    const policySelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement
    fireEvent.change(policySelect, { target: { value: "UK_ISA" } })
    const applied = onSubAccountsChange.mock.calls[0][0] as { code: string }[]
    expect(applied.map((a) => a.code)).toEqual(["BAL"])
    expect(onTaxTreatmentChange).toHaveBeenCalledWith("TAX_FREE")

    // Re-render as the committed UK_ISA state — no tax-treatment/deferral/
    // match fields for ISA; TAX_FREE is implied, not user-editable.
    render(
      <CompositeAssetEditor
        {...baseProps}
        policyType="UK_ISA"
        taxTreatment="TAX_FREE"
        subAccounts={[makeSubAccount({ code: "BAL", displayName: "Balance" })]}
      />,
    )
    expect(screen.queryByRole("radio")).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/Employee Deferral/i),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText(/Withdrawal Tax Rate/i),
    ).not.toBeInTheDocument()
  })

  it("clears wrapper fields when switching away from a US wrapper policy type", () => {
    const onTaxTreatmentChange = jest.fn()
    const onEmployeeDeferralPercentChange = jest.fn()
    const onEmployerMatchPercentChange = jest.fn()
    const onEmployerMatchCapPercentChange = jest.fn()
    const onWithdrawalTaxRateChange = jest.fn()
    render(
      <CompositeAssetEditor
        {...baseProps}
        policyType="US_401K"
        taxTreatment="TRADITIONAL"
        employeeDeferralPercent={0.06}
        employerMatchPercent={0.03}
        employerMatchCapPercent={0.06}
        withdrawalTaxRate={0.22}
        onTaxTreatmentChange={onTaxTreatmentChange}
        onEmployeeDeferralPercentChange={onEmployeeDeferralPercentChange}
        onEmployerMatchPercentChange={onEmployerMatchPercentChange}
        onEmployerMatchCapPercentChange={onEmployerMatchCapPercentChange}
        onWithdrawalTaxRateChange={onWithdrawalTaxRateChange}
      />,
    )
    const policySelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement
    fireEvent.change(policySelect, { target: { value: "ILP" } })
    expect(onTaxTreatmentChange).toHaveBeenCalledWith(undefined)
    expect(onEmployeeDeferralPercentChange).toHaveBeenCalledWith(undefined)
    expect(onEmployerMatchPercentChange).toHaveBeenCalledWith(undefined)
    expect(onEmployerMatchCapPercentChange).toHaveBeenCalledWith(undefined)
    expect(onWithdrawalTaxRateChange).toHaveBeenCalledWith(undefined)
  })
})
