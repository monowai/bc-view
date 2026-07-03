import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import LinkCompositeDialog from "@components/features/portfolios/LinkCompositeDialog"

jest.mock("@hooks/usePortfolios", () => ({
  usePortfolios: () => ({ portfolios: [] }),
}))

jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({ preferences: {} }),
}))

jest.mock("@lib/user/zenMode", () => ({
  showPortfolioPicker: () => false,
  solePortfolio: () => null,
}))

const config = {
  assetId: "cpf1",
  assetName: "TestAsset",
  currency: "SGD",
  total: 10000,
  subAccounts: [
    { code: "OA", displayName: "Ordinary Account", balance: 5000, liquid: true },
  ],
}

describe("LinkCompositeDialog", () => {
  it("renders title 'Link TestAsset'", () => {
    render(<LinkCompositeDialog config={config as any} onClose={jest.fn()} />)
    expect(screen.getByText("Link TestAsset")).toBeInTheDocument()
  })

  it("calls onClose on Escape", () => {
    const onClose = jest.fn()
    render(<LinkCompositeDialog config={config as any} onClose={onClose} />)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })
})
