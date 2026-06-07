import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { SWRConfig } from "swr"
import ScenarioContributions from "@components/features/independence/scenarios/ScenarioContributions"

// Regression for DEMO-ISSUES #4 — "No pension or policy assets configured"
// even though the user has a CPF asset with isPension=true. Root cause was
// that ScenarioContributions passed the simpleFetcher *factory* to useSWR
// instead of invoking it with the key (`simpleFetcher(url)`). SWR then
// treated the factory function as the resolved data, the component read
// `configsResp?.data || []` (undefined → []), and the empty-state path
// was the only one ever rendered.
//
// We do NOT mock `swr` here — we want the real SWR runtime to resolve the
// fetcher exactly as it does in production. `simpleFetcher` is mocked to
// return a key-driven async result, and we assert that the rendered output
// contains the pension assets. A regressed wiring (passing the factory)
// would render the "No pension or policy assets configured" message.

const previewResponse = {
  data: {
    annualContribution: 12000,
    monthlyContribution: 1000,
    annualOa: 0,
    annualSa: 0,
    annualMa: 0,
    employeeRate: 0,
    employerRate: 0,
    cappedSalary: 0,
    wageCeiling: 0,
  },
}

const configsResponse = {
  data: [
    {
      assetId: "cpf-1",
      isPension: true,
      contributionFrequency: "MONTHLY",
      policyType: "CPF",
    },
  ],
  assetNames: { "cpf-1": "Mary's CPF" },
}

const contributionsResponse = { data: [] }

jest.mock("@utils/api/fetchHelper", () => {
  const simpleFetcher = jest.fn((url: string) => () => {
    if (url === "/api/assets/config")
      return Promise.resolve(configsResponse)
    if (url.startsWith("/api/independence/work-scenarios/"))
      return Promise.resolve(contributionsResponse)
    if (url.startsWith("/api/independence/cpf/contribution-preview"))
      return Promise.resolve(previewResponse)
    return Promise.resolve({ data: [] })
  })
  return {
    __esModule: true,
    simpleFetcher,
    ccyKey: "/api/currencies",
    holdingKey: () => "",
    portfoliosKey: "/api/portfolios",
  }
})

import { simpleFetcher } from "@utils/api/fetchHelper"

function renderInFreshSwrCache(): void {
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <ScenarioContributions
        scenarioId="scn-1"
        currency="SGD"
        monthlySalary={6250}
        currentAge={45}
      />
    </SWRConfig>,
  )
}

describe("ScenarioContributions — SWR fetcher wiring", () => {
  beforeEach(() => {
    ;(simpleFetcher as jest.Mock).mockClear()
  })

  it("invokes simpleFetcher with each SWR key (not the factory itself)", async () => {
    renderInFreshSwrCache()
    await waitFor(() => {
      expect(
        (simpleFetcher as jest.Mock).mock.calls.map((c) => c[0]),
      ).toEqual(
        expect.arrayContaining([
          "/api/assets/config",
          "/api/independence/work-scenarios/scn-1/contributions",
          expect.stringContaining("/api/independence/cpf/contribution-preview"),
        ]),
      )
    })
  })

  it("renders the pension asset when the configs SWR resolves with isPension=true", async () => {
    renderInFreshSwrCache()
    await waitFor(() => {
      expect(screen.getByText("Mary's CPF")).toBeInTheDocument()
    })
    expect(
      screen.queryByText(/No pension or policy assets configured/i),
    ).not.toBeInTheDocument()
  })
})
