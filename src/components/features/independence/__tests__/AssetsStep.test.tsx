import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { useForm, FormProvider } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import AssetsStep from "../steps/AssetsStep"
import { goalsSchema, defaultWizardValues } from "@lib/independence/schema"
import { WizardFormData } from "types/independence"

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

// Mutable reference used inside the SWR mock so individual tests can override
// the portfolio data without rebuilding the whole mock factory. Starts with
// "mock" so Jest's Babel hoisting picks it up alongside jest.mock().
let mockSwrPortfolioData: { data: unknown[] } = mockPortfolios

// AssetsStep calls multiple SWR hooks plus direct fetch() calls. Both
// produce async state updates that fall outside React Testing Library's
// implicit act() window and trigger "An update to AssetsStep was not
// wrapped in act(...)". Mock SWR to resolve synchronously and stub fetch
// so nothing queues a microtask.
jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string) => ({
    data: (key as string).includes("portfolios")
      ? mockSwrPortfolioData
      : { data: [] },
    error: undefined,
    isLoading: false,
    mutate: jest.fn(),
  }),
  mutate: jest.fn(),
  SWRConfig: ({ children }: { children: React.ReactNode }) => children,
}))

beforeAll(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ data: [] }),
    text: () => Promise.resolve(""),
  }) as unknown as typeof fetch
})

beforeEach(() => {
  // Reset to the default (portfolios present) before each test
  mockSwrPortfolioData = mockPortfolios
})

const TestWrapper: React.FC<{ children: React.ReactNode }> = () => {
  const methods = useForm<WizardFormData>({
    resolver: yupResolver(goalsSchema) as any,
    defaultValues: defaultWizardValues,
    mode: "onBlur",
  })

  return (
    <FormProvider {...methods}>
      <form>
        <AssetsStep control={methods.control} setValue={methods.setValue} />
      </form>
    </FormProvider>
  )
}

describe("AssetsStep", () => {
  // AssetsStep has a useEffect that awaits multiple fetches and calls
  // setState after the microtask hops. Using async tests + findBy* flushes
  // those effects inside act().
  it("renders the assets step header", async () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(await screen.findByText(/your wealth/i)).toBeInTheDocument()
  })

  it("shows portfolio selection section", async () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(await screen.findByText(/select portfolios/i)).toBeInTheDocument()
  })

  it("shows description text", async () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(
      await screen.findByText(/we've selected your portfolios automatically/i),
    ).toBeInTheDocument()
  })

  it("shows read-only info banner pointing to Net Worth tab", async () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    expect(await screen.findByText(/net worth tab/i)).toBeInTheDocument()
  })

  it("renders portfolio checkboxes as disabled", async () => {
    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    // Wait for portfolio rows to appear, then verify all checkboxes are disabled
    await screen.findByText("TEST")
    const checkboxes = screen.getAllByRole("checkbox")
    checkboxes.forEach((cb) => expect(cb).toBeDisabled())
  })

  it("renders manual asset inputs as disabled when no portfolios", async () => {
    // Override: no portfolios so the manual-asset fallback branch renders
    mockSwrPortfolioData = { data: [] }

    render(
      <TestWrapper>
        <div />
      </TestWrapper>,
    )

    // The manual-asset inputs are type="number" (spinbutton role)
    const inputs = await screen.findAllByRole("spinbutton")
    inputs.forEach((input) => expect(input).toBeDisabled())
  })
})
