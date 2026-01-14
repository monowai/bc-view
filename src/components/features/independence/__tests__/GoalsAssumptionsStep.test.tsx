import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { useForm, FormProvider } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import GoalsAssumptionsStep from "../steps/GoalsAssumptionsStep"
import { goalsSchema, defaultWizardValues } from "@lib/independence/schema"
import { WizardFormData } from "types/independence"
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

const TestWrapper: React.FC<{ children: React.ReactNode }> = () => {
  const methods = useForm<WizardFormData>({
    resolver: yupResolver(goalsSchema) as any,
    defaultValues: defaultWizardValues,
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
          <GoalsAssumptionsStep
            control={methods.control}
            errors={methods.formState.errors}
            setValue={methods.setValue}
          />
        </form>
      </FormProvider>
    </SWRConfig>
  )
}

describe("GoalsAssumptionsStep", () => {
  it("renders the goals step header", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(screen.getByText(/goals & assumptions/i)).toBeInTheDocument()
  })

  it("shows portfolio selection section", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(screen.getByText(/select portfolios/i)).toBeInTheDocument()
  })

  it("shows return assumption fields", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(screen.getByLabelText(/equity return rate/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/cash return rate/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/housing return rate/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/inflation rate/i)).toBeInTheDocument()
  })

  it("shows default return rate values", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(screen.getByLabelText(/equity return rate/i)).toHaveValue(8)
    expect(screen.getByLabelText(/cash return rate/i)).toHaveValue(3)
    expect(screen.getByLabelText(/housing return rate/i)).toHaveValue(4)
    expect(screen.getByLabelText(/inflation rate/i)).toHaveValue(2.5)
  })

  it("shows target balance field", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(screen.getByLabelText(/target ending balance/i)).toBeInTheDocument()
  })

  it("shows target balance description", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(
      screen.getByText(
        /set a target ending balance if you want to leave a legacy/i,
      ),
    ).toBeInTheDocument()
  })
})
