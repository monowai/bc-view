import React from "react"
import { render } from "@testing-library/react"
import PensionProjectionPanel from "@components/features/independence/scenarios/PensionProjectionPanel"

const mockKeys: (string | null)[] = []
jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string | null) => {
    mockKeys.push(key)
    return { data: undefined, error: undefined, isLoading: false }
  },
}))

describe("PensionProjectionPanel", () => {
  beforeEach(() => {
    mockKeys.length = 0
  })

  it("asks for the CPF balance series in the asset's currency", () => {
    // Balances and pay are in the asset's currency; svc-retire restates CPF's
    // SGD limits in it (svc-retire #348).
    render(
      <PensionProjectionPanel
        policyType="CPF"
        currency="NZD"
        currentAge={50}
        subAccounts={[{ code: "OA", balance: 1000 }]}
      />,
    )

    const cpfKey = mockKeys.find((k) => k?.includes("/cpf/balance-series"))
    expect(cpfKey).toContain("&currency=NZD")
  })
})
