import React, { useEffect, useState } from "react"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import AssetsStep from "@components/features/onboarding/steps/AssetsStep"
import type {
  BankAccount,
  Insurance,
  Pension,
  Property,
} from "@components/features/onboarding/OnboardingWizard"

// The policy editor has its own tests; the stub drives the callbacks the step wires.
jest.mock("@components/features/assets/CompositeAssetEditor", () => ({
  __esModule: true,
  default: (p: Record<string, (...a: unknown[]) => void>) => (
    <div>
      <button onClick={() => p.onPolicyTypeChange("CPF")}>{"stub-cpf"}</button>
      <button
        onClick={() => {
          p.onPolicyTypeChange("US_401K")
          p.onLockedUntilDateChange("2045-01-01")
          p.onSubAccountsChange([{ code: "PRE", balance: 10, liquid: false }])
          p.onCpfLifePlanChange("BASIC")
          p.onCpfPayoutStartAgeChange(67)
          p.onTaxTreatmentChange("PRE_TAX")
          p.onEmployeeDeferralPercentChange(0.06)
          p.onEmployerMatchPercentChange(0.5)
          p.onEmployerMatchCapPercentChange(0.06)
          p.onWithdrawalTaxRateChange(0.2)
        }}
      >
        {"stub-401k"}
      </button>
    </div>
  ),
}))

interface Captured {
  banks: BankAccount[]
  props: Property[]
  pens: Pension[]
  ins: Insurance[]
}
let captured: Captured

function Harness(init: Partial<Captured> = {}): React.ReactElement {
  const [banks, setBanks] = useState<BankAccount[]>(init.banks ?? [])
  const [props, setProps] = useState<Property[]>(init.props ?? [])
  const [pens, setPens] = useState<Pension[]>(init.pens ?? [])
  const [ins, setIns] = useState<Insurance[]>(init.ins ?? [])
  useEffect(() => {
    captured = { banks, props, pens, ins }
  })
  return (
    <AssetsStep
      baseCurrency="NZD"
      bankAccounts={banks}
      properties={props}
      pensions={pens}
      insurances={ins}
      onBankAccountsChange={setBanks}
      onPropertiesChange={setProps}
      onPensionsChange={setPens}
      onInsurancesChange={setIns}
    />
  )
}

const pick = async (
  user: ReturnType<typeof userEvent.setup>,
  title: string,
): Promise<void> => {
  await user.click(screen.getByRole("button", { name: new RegExp(title) }))
}

describe("AssetsStep", () => {
  it("offers the four asset types", () => {
    render(<Harness />)
    for (const t of [
      "Bank Account",
      "Pension Plan",
      "Life Insurance",
      "Property",
    ]) {
      expect(
        screen.getByRole("button", { name: new RegExp(t) }),
      ).toBeInTheDocument()
    }
    expect(screen.queryByText("Assets added")).not.toBeInTheDocument()
  })

  describe("bank account", () => {
    it("adds an account with a currency and an evaluated balance", async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await pick(user, "Bank Account")
      const save = screen.getByRole("button", { name: "Save Account" })
      expect(save).toBeDisabled()
      await user.type(screen.getByPlaceholderText(/Main Savings/), "Everyday")
      await user.selectOptions(screen.getByDisplayValue("NZD"), "USD")
      await user.type(screen.getByPlaceholderText("Optional"), "2k")
      await user.tab()
      await user.click(save)
      expect(captured.banks).toEqual([
        { name: "Everyday", currency: "USD", balance: 2000 },
      ])
      expect(screen.getByText("Assets added")).toBeInTheDocument()
      expect(screen.getByText("Everyday")).toBeInTheDocument()
      expect(screen.getByText("(USD)")).toBeInTheDocument()
      expect(screen.getByText("2,000")).toBeInTheDocument()
      // back to the picker
      expect(
        screen.getByRole("button", { name: /Property/ }),
      ).toBeInTheDocument()
    })

    it("cancels without adding and clears the form", async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await pick(user, "Bank Account")
      await user.type(screen.getByPlaceholderText(/Main Savings/), "Temp")
      await user.click(screen.getByRole("button", { name: "Cancel" }))
      expect(captured.banks).toEqual([])
      await pick(user, "Bank Account")
      expect(screen.getByPlaceholderText(/Main Savings/)).toHaveValue("")
    })

    it("removes an added account", async () => {
      const user = userEvent.setup()
      render(<Harness banks={[{ name: "Old", currency: "NZD" }]} />)
      const row = screen.getByText("Old").closest("div")!.parentElement!
      await user.click(within(row).getByRole("button"))
      expect(captured.banks).toEqual([])
    })
  })

  describe("property", () => {
    it("requires a name and a positive price", async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await pick(user, "Property")
      const save = screen.getByRole("button", { name: "Save Property" })
      await user.type(screen.getByPlaceholderText(/Main Residence/), "Beach")
      expect(save).toBeDisabled()
      await user.type(screen.getByPlaceholderText("0"), "500k")
      await user.tab()
      expect(save).toBeEnabled()
    })

    it("adds a property with purchase date and current value", async () => {
      const user = userEvent.setup()
      const { container } = render(<Harness />)
      await pick(user, "Property")
      await user.type(screen.getByPlaceholderText(/Main Residence/), "Beach")
      await user.type(
        container.querySelector('input[type="date"]') as HTMLElement,
        "2020-03-04",
      )
      await user.type(screen.getByPlaceholderText("0"), "500k")
      await user.tab()
      await user.type(screen.getByPlaceholderText("Same as purchase"), "650k")
      await user.tab()
      await user.click(screen.getByRole("button", { name: "Save Property" }))
      expect(captured.props).toEqual([
        {
          name: "Beach",
          price: 500000,
          value: 650000,
          purchaseDate: "2020-03-04",
        },
      ])
      expect(screen.getByText("NZD 650,000")).toBeInTheDocument()
    })

    it("shows the purchase price when no current value is stored, and removes", async () => {
      const user = userEvent.setup()
      render(<Harness props={[{ name: "Land", price: 100000 }]} />)
      expect(screen.getByText("NZD 100,000")).toBeInTheDocument()
      const row = screen.getByText("Land").closest("div")!.parentElement!
      await user.click(within(row).getByRole("button"))
      expect(captured.props).toEqual([])
    })

    it("cancels", async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await pick(user, "Property")
      await user.click(screen.getByRole("button", { name: "Cancel" }))
      expect(
        screen.getByRole("button", { name: /Bank Account/ }),
      ).toBeInTheDocument()
    })
  })

  describe("pension", () => {
    it("adds a monthly-payout pension", async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await pick(user, "Pension Plan")
      await user.type(screen.getByPlaceholderText(/KiwiSaver/), "Super")
      await user.selectOptions(screen.getByDisplayValue("NZD"), "AUD")
      const [balance, payout] = screen.getAllByPlaceholderText("Optional")
      await user.type(balance, "50k")
      await user.tab()
      const rate = screen.getByPlaceholderText("5.0")
      await user.clear(rate)
      await user.type(rate, "6.5")
      await user.type(screen.getByPlaceholderText("0"), "12h/12")
      await user.tab()
      await user.type(screen.getByPlaceholderText("e.g., 65"), "62")
      await user.type(payout, "1500")
      await user.tab()
      await user.click(screen.getByRole("button", { name: "Save Pension" }))
      expect(captured.pens).toHaveLength(1)
      expect(captured.pens[0]).toMatchObject({
        name: "Super",
        currency: "AUD",
        balance: 50000,
        expectedReturnRate: 0.065,
        monthlyContribution: 100,
        payoutAge: 62,
        monthlyPayoutAmount: 1500,
        lumpSum: false,
      })
      expect(screen.getByText("@ age 62")).toBeInTheDocument()
    })

    it("clears the monthly payout when switching to lump sum", async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await pick(user, "Pension Plan")
      await user.type(screen.getByPlaceholderText(/KiwiSaver/), "Pot")
      await user.type(screen.getAllByPlaceholderText("Optional")[1], "900")
      await user.tab()
      await user.click(screen.getByLabelText(/Pays out in full/))
      expect(screen.getAllByPlaceholderText("Optional")).toHaveLength(1)
      await user.type(screen.getByPlaceholderText("e.g., 65"), "65")
      await user.click(screen.getByRole("button", { name: "Save Pension" }))
      expect(captured.pens[0]).toMatchObject({
        lumpSum: true,
        monthlyPayoutAmount: undefined,
        payoutAge: 65,
      })
      expect(screen.getByText(/\(lump sum\)/)).toBeInTheDocument()
    })

    it("keeps typed values when the policy type changes (no stale clobbering)", async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await pick(user, "Pension Plan")
      await user.type(screen.getByPlaceholderText(/KiwiSaver/), "Wrapper")
      await user.click(screen.getByText("stub-401k"))
      await user.click(screen.getByRole("button", { name: "Save Pension" }))
      expect(captured.pens[0]).toMatchObject({
        name: "Wrapper",
        policyType: "US_401K",
        lockedUntilDate: "2045-01-01",
        subAccounts: [{ code: "PRE", balance: 10, liquid: false }],
        cpfLifePlan: "BASIC",
        payoutAge: 67,
        taxTreatment: "PRE_TAX",
        employeeDeferralPercent: 0.06,
        employerMatchPercent: 0.5,
        employerMatchCapPercent: 0.06,
        withdrawalTaxRate: 0.2,
      })
      expect(screen.getByText("[US_401K]")).toBeInTheDocument()
    })

    it("drops salary-derived contribution and generic payout fields for CPF", async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await pick(user, "Pension Plan")
      await user.type(screen.getByPlaceholderText(/KiwiSaver/), "CPF")
      await user.type(screen.getByPlaceholderText("0"), "300")
      await user.tab()
      await user.click(screen.getByText("stub-cpf"))
      expect(screen.queryByPlaceholderText("5.0")).not.toBeInTheDocument()
      expect(
        screen.queryByLabelText(/Pays out in full/),
      ).not.toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Save Pension" }))
      expect(captured.pens[0].policyType).toBe("CPF")
      expect(captured.pens[0].monthlyContribution).toBeUndefined()
    })

    it("shows balance of an added pension and removes it", async () => {
      const user = userEvent.setup()
      render(
        <Harness
          pens={[
            {
              name: "Fund",
              currency: "NZD",
              balance: 12345,
              payoutAge: 60,
              lumpSum: true,
              policyType: "GENERIC",
            },
          ]}
        />,
      )
      expect(screen.getByText("12,345")).toBeInTheDocument()
      expect(screen.getByText("[GENERIC]")).toBeInTheDocument()
      const row = screen.getByText("Fund").closest("div")!.parentElement!
      await user.click(within(row).getByRole("button"))
      expect(captured.pens).toEqual([])
    })

    it("cancels", async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await pick(user, "Pension Plan")
      await user.click(screen.getByRole("button", { name: "Cancel" }))
      expect(captured.pens).toEqual([])
    })
  })

  describe("life insurance", () => {
    it("adds a lump-sum policy by default", async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await pick(user, "Life Insurance")
      expect(
        screen.queryByText("Monthly Payout Amount"),
      ).not.toBeInTheDocument()
      await user.type(screen.getByPlaceholderText(/Term Life/), "Whole Life")
      await user.selectOptions(screen.getByDisplayValue("NZD"), "SGD")
      await user.type(screen.getAllByPlaceholderText("Optional")[0], "8k")
      await user.tab()
      const rate = screen.getByPlaceholderText("3.0")
      await user.clear(rate)
      await user.type(rate, "4")
      const [maturity] = screen
        .getAllByRole("spinbutton")
        .filter((el) => el.getAttribute("placeholder") === "Optional")
      await user.type(maturity, "70")
      await user.type(screen.getByPlaceholderText("0"), "200")
      await user.tab()
      await user.click(screen.getByRole("button", { name: "Save Insurance" }))
      expect(captured.ins[0]).toMatchObject({
        name: "Whole Life",
        currency: "SGD",
        currentValue: 8000,
        expectedReturnRate: 0.04,
        payoutAge: 70,
        monthlyContribution: 200,
        lumpSum: true,
      })
    })

    it("switches to monthly payments and back, clearing the payout amount", async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await pick(user, "Life Insurance")
      await user.type(screen.getByPlaceholderText(/Term Life/), "Annuity")
      await user.click(screen.getByLabelText(/Monthly payments/))
      expect(screen.getByText("Monthly Payout Amount")).toBeInTheDocument()
      const inputs = screen.getAllByPlaceholderText("Optional")
      await user.type(inputs[inputs.length - 1], "700")
      await user.tab()
      await user.click(screen.getByRole("button", { name: "Save Insurance" }))
      expect(captured.ins[0]).toMatchObject({
        lumpSum: false,
        payoutAmount: 700,
      })
    })

    it("clears a typed payout when returning to lump sum", async () => {
      const user = userEvent.setup()
      render(<Harness />)
      await pick(user, "Life Insurance")
      await user.type(screen.getByPlaceholderText(/Term Life/), "P")
      await user.click(screen.getByLabelText(/Monthly payments/))
      const inputs = screen.getAllByPlaceholderText("Optional")
      await user.type(inputs[inputs.length - 1], "700")
      await user.tab()
      await user.click(screen.getByLabelText(/Lump sum at maturity/))
      await user.click(screen.getByRole("button", { name: "Save Insurance" }))
      expect(captured.ins[0]).toMatchObject({
        lumpSum: true,
        payoutAmount: undefined,
      })
    })

    it("removes an added policy and cancels the form", async () => {
      const user = userEvent.setup()
      render(
        <Harness ins={[{ name: "Term", currency: "NZD", lumpSum: true }]} />,
      )
      const row = screen.getByText("Term").closest("div")!.parentElement!
      await user.click(within(row).getByRole("button"))
      expect(captured.ins).toEqual([])
      await pick(user, "Life Insurance")
      await user.click(screen.getByRole("button", { name: "Cancel" }))
      expect(
        screen.getByRole("button", { name: /Pension Plan/ }),
      ).toBeInTheDocument()
    })
  })
})
