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

// AssetsStep calls multiple SWR hooks plus direct fetch() calls. Both
// produce async state updates that fall outside React Testing Library's
// implicit act() window and trigger "An update to AssetsStep was not
// wrapped in act(...)". Mock SWR to resolve synchronously and stub fetch
// so nothing queues a microtask.
jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string) => ({
    data: key.includes("portfolios") ? mockPortfolios : { data: [] },
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
})
