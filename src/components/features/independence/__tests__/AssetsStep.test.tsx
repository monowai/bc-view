import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { useForm, FormProvider } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import AssetsStep from "../steps/AssetsStep"
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
          <AssetsStep control={methods.control} setValue={methods.setValue} />
        </form>
      </FormProvider>
    </SWRConfig>
  )
}

describe("AssetsStep", () => {
  it("renders the assets step header", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(screen.getByText(/your wealth/i)).toBeInTheDocument()
  })

  it("shows portfolio selection section", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(screen.getByText(/select portfolios/i)).toBeInTheDocument()
  })

  it("shows description text", () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(
      screen.getByText(/we've selected your portfolios automatically/i),
    ).toBeInTheDocument()
  })
})
