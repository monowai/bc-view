import React from "react"
import { render, screen } from "@testing-library/react"

const routerState: {
  isReady: boolean
  query: Record<string, string>
  push: jest.Mock
} = {
  isReady: false,
  query: {},
  push: jest.fn(),
}
jest.mock("next/router", () => ({
  useRouter: () => routerState,
}))

import useSwr from "swr"
jest.mock("swr")
const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

// ModelPlans pulls the plan list through its own SWR call; stub it out so the
// test focuses on the model detail loading path.
jest.mock(
  "../../../../src/components/features/rebalance/models/ModelPlans",
  () => ({
    __esModule: true,
    default: () => <div data-testid="model-plans" />,
  }),
)

const model = {
  id: "model-1",
  name: "Aggressive Growth",
  baseCurrency: "USD",
}

const idle = {
  data: undefined,
  error: undefined,
  isLoading: false,
  isValidating: false,
  mutate: jest.fn(),
}

function swrByKey(key: unknown): ReturnType<typeof useSwr> {
  if (!key) return idle as unknown as ReturnType<typeof useSwr>
  if (String(key).endsWith("/models/model-1")) {
    return { ...idle, data: { data: model } } as unknown as ReturnType<
      typeof useSwr
    >
  }
  return idle as unknown as ReturnType<typeof useSwr>
}

describe("/rebalance/models/[modelId] — Model detail", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
    mockUseSwr.mockImplementation((key: unknown) => swrByKey(key))
    routerState.isReady = false
    routerState.query = {}
  })

  test("shows a loading state (not an empty page) before the router is ready", async () => {
    const { default: ModelDetailPage } =
      await import("../../../../src/pages/rebalance/models/[modelId]")
    render(<ModelDetailPage />)

    // Must not commit the empty/error state while the route param is unknown.
    expect(screen.queryByText(/Failed to load model/i)).not.toBeInTheDocument()
    expect(screen.queryByText("Aggressive Growth")).not.toBeInTheDocument()
  })

  test("renders the model once the router becomes ready (no manual refresh)", async () => {
    const { default: ModelDetailPage } =
      await import("../../../../src/pages/rebalance/models/[modelId]")
    const { rerender } = render(<ModelDetailPage />)

    routerState.isReady = true
    routerState.query = { modelId: "model-1" }
    rerender(<ModelDetailPage />)

    expect(
      await screen.findByRole("heading", { name: "Aggressive Growth" }),
    ).toBeInTheDocument()
    expect(screen.getByTestId("model-plans")).toBeInTheDocument()
  })
})
