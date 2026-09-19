import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { useForm, FormProvider } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import AssumptionsStep from "../steps/AssumptionsStep"
import { goalsSchema, defaultWizardValues } from "@lib/independence/schema"
import { journeyAssumptionsHref } from "@lib/independence/editPhase"
import { IndependencePlan, WizardFormData } from "types/independence"
import { SWRConfig } from "swr"

// Mock portfolios data
const mockPortfolios = {
  data: [
    {
      id: "port-1",
      code: "TEST",
      name: "Test Portfolio",
      marketValue: 100000,
      base: { code: "NZD", name: "New Zealand Dollar", symbol: "$" },
    },
    {
      id: "port-2",
      code: "SUPER",
      name: "Superannuation",
      marketValue: 250000,
      base: { code: "NZD", name: "New Zealand Dollar", symbol: "$" },
    },
  ],
}

const TestWrapper: React.FC<{
  children?: React.ReactNode
  journey?: IndependencePlan
  defaults?: Partial<WizardFormData>
}> = ({ journey, defaults }) => {
  const methods = useForm<WizardFormData>({
    resolver: yupResolver(goalsSchema) as any,
    defaultValues: { ...defaultWizardValues, ...defaults },
    mode: "onBlur",
  })

  return (
    <SWRConfig
      value={{
        fetcher: () => Promise.resolve(mockPortfolios),
        dedupingInterval: 0,
      }}
    >
      <FormProvider {...methods}>
        <form>
          <AssumptionsStep
            control={methods.control}
            errors={methods.formState.errors}
            setValue={methods.setValue}
            journey={journey}
          />
        </form>
      </FormProvider>
    </SWRConfig>
  )
}

function makeJourney(
  overrides: Partial<IndependencePlan> = {},
): IndependencePlan {
  return {
    id: "j1",
    ownerId: "u1",
    name: "Main journey",
    isPrimary: true,
    createdDate: "2026-01-01",
    updatedDate: "2026-01-01",
    // Decimal fractions on the wire — 0.07 is 7%.
    cashReturnRate: 0.025,
    equityReturnRate: 0.07,
    housingReturnRate: 0.035,
    inflationRate: 0.02,
    feeRate: 0.004,
    investmentTaxRate: 0.15,
    ...overrides,
  }
}

async function openReturns(): Promise<void> {
  await userEvent.click(
    screen.getByRole("button", { name: /return assumptions/i }),
  )
}

describe("AssumptionsStep", () => {
  it("renders the assumptions step header", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(screen.getByText(/financial assumptions/i)).toBeInTheDocument()
  })

  it("shows return assumption fields when accordion is opened", async () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    // Click the Return Assumptions accordion to open it
    await userEvent.click(
      screen.getByRole("button", { name: /return assumptions/i }),
    )

    expect(screen.getByLabelText(/equity return rate/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/cash return rate/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/housing return rate/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/inflation rate/i)).toBeInTheDocument()
  })

  it("shows default return rate values when accordion is opened", async () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    await userEvent.click(
      screen.getByRole("button", { name: /return assumptions/i }),
    )

    expect(screen.getByLabelText(/equity return rate/i)).toHaveValue("8")
    expect(screen.getByLabelText(/cash return rate/i)).toHaveValue("3")
    expect(screen.getByLabelText(/housing return rate/i)).toHaveValue("4")
    expect(screen.getByLabelText(/inflation rate/i)).toHaveValue("2.5")
  })

  it("shows target balance field when accordion is opened", async () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByRole("button", { name: /legacy/i }))

    expect(
      screen.getByRole("textbox", { name: /target amount/i }),
    ).toBeInTheDocument()
  })

  it("shows target balance description when accordion is opened", async () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    await userEvent.click(screen.getByRole("button", { name: /legacy/i }))

    expect(
      screen.getByText(
        /set a target ending balance if you want to leave a legacy/i,
      ),
    ).toBeInTheDocument()
  })

  it("shows asset allocation fields when accordion is opened", async () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    // The heading is visible in the accordion header even when collapsed
    expect(
      screen.getByRole("heading", { name: /asset allocation/i }),
    ).toBeInTheDocument()

    // Click to open and see the input fields
    await userEvent.click(
      screen.getByRole("button", { name: /asset allocation/i }),
    )

    expect(screen.getByLabelText(/equities \(%\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/cash \(%\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/housing \(%\)/i)).toBeInTheDocument()
  })
})

describe("AssumptionsStep — inheriting a journey's assumptions", () => {
  it("offers no override switch for a stage with no journey to inherit from", async () => {
    render(<TestWrapper />)
    await openReturns()

    expect(
      screen.queryByRole("switch", { name: /override for this stage/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/these come from your journey/i),
    ).not.toBeInTheDocument()
    // Today's editable inputs, untouched.
    expect(screen.getByLabelText(/equity return rate/i)).toBeInTheDocument()
  })

  it("reads the journey's rates back instead of editable inputs while inheriting", async () => {
    render(<TestWrapper journey={makeJourney()} />)
    await openReturns()

    const toggle = screen.getByRole("switch", {
      name: /override for this stage/i,
    })
    expect(toggle).toHaveAttribute("aria-checked", "false")

    expect(
      screen.queryByLabelText(/equity return rate/i),
    ).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/inflation rate/i)).not.toBeInTheDocument()

    // Percentages, from the journey's decimals.
    expect(screen.getByText("7%")).toBeInTheDocument()
    expect(screen.getByText("2.5%")).toBeInTheDocument()
    expect(screen.getByText("3.5%")).toBeInTheDocument()
    expect(screen.getByText("2%")).toBeInTheDocument()
  })

  it("shows the journey's fee and investment-tax rates, which the wizard never edited", async () => {
    render(<TestWrapper journey={makeJourney()} />)
    await openReturns()

    expect(screen.getByText(/^Fees$/)).toBeInTheDocument()
    expect(screen.getByText("0.4%")).toBeInTheDocument()
    expect(screen.getByText(/^Investment tax$/)).toBeInTheDocument()
    expect(screen.getByText("15%")).toBeInTheDocument()
  })

  it("says so plainly when the journey has never stated a rate", async () => {
    render(
      <TestWrapper
        journey={makeJourney({
          housingReturnRate: undefined,
          feeRate: undefined,
        })}
      />,
    )
    await openReturns()

    expect(
      screen.getAllByText(/not set — this stage's own value applies/i),
    ).toHaveLength(2)
  })

  it("points at journey settings for the edit, carrying the journey", async () => {
    render(<TestWrapper journey={makeJourney()} />)
    await openReturns()

    expect(
      screen.getByText(/these come from your journey/i),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: /edit in journey settings/i }),
    ).toHaveAttribute("href", journeyAssumptionsHref("j1"))
  })

  it("treats an unset inherit flag as inheriting, like the rest of the step", async () => {
    // A form seeded from an older draft can carry `undefined` here. The switch
    // reads the same default `isInheriting` does, so the control and the rows
    // beneath it can never disagree about which state the stage is in.
    render(
      <TestWrapper
        journey={makeJourney()}
        defaults={{ assumptionsInherited: undefined }}
      />,
    )
    await openReturns()

    expect(
      screen.getByRole("switch", { name: /override for this stage/i }),
    ).toHaveAttribute("aria-checked", "false")
    expect(
      screen.getByText(/these come from your journey/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText(/equity return rate/i),
    ).not.toBeInTheDocument()
  })

  it("restores the editable inputs when the stage takes over", async () => {
    render(<TestWrapper journey={makeJourney()} />)
    await openReturns()

    await userEvent.click(
      screen.getByRole("switch", { name: /override for this stage/i }),
    )

    expect(
      screen.getByRole("switch", { name: /override for this stage/i }),
    ).toHaveAttribute("aria-checked", "true")
    expect(screen.getByLabelText(/equity return rate/i)).toHaveValue("8")
    expect(screen.getByLabelText(/inflation rate/i)).toHaveValue("2.5")
    expect(
      screen.queryByText(/these come from your journey/i),
    ).not.toBeInTheDocument()
  })

  it("opens on the editable inputs for a stage already overriding", async () => {
    render(
      <TestWrapper
        journey={makeJourney()}
        defaults={{ assumptionsInherited: false }}
      />,
    )
    await openReturns()

    expect(
      screen.getByRole("switch", { name: /override for this stage/i }),
    ).toHaveAttribute("aria-checked", "true")
    expect(screen.getByLabelText(/equity return rate/i)).toBeInTheDocument()
  })

  it("leaves allocation and the legacy target per stage, journey or not", async () => {
    // Allocation is NOT part of the inherited set — it stays editable here.
    render(<TestWrapper journey={makeJourney()} />)

    await userEvent.click(
      screen.getByRole("button", { name: /asset allocation/i }),
    )
    expect(screen.getByLabelText(/equities \(%\)/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: /legacy/i }))
    expect(
      screen.getByRole("textbox", { name: /target amount/i }),
    ).toBeInTheDocument()
  })
})
