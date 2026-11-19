import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const router = { back: jest.fn(), push: jest.fn() }
jest.mock("next/router", () => ({ useRouter: () => router }))
jest.mock("@auth0/nextjs-auth0/client", () => ({
  withPageAuthRequired: (page: React.ComponentType) => page,
}))
jest.mock(
  "@components/features/brokers/statementImport/StatementImport",
  () =>
    function StatementImport(): React.ReactElement {
      return <div />
    },
)

import BrokerageImportPage from "@pages/brokers/import"

describe("Import from image or CSV page", () => {
  beforeEach(() => {
    router.back.mockReset()
    router.push.mockReset()
  })

  it("Back returns to the page the user came from", async () => {
    window.history.pushState({}, "", "/wealth")
    window.history.pushState({}, "", "/brokers/import")
    render(<BrokerageImportPage />)

    await userEvent.click(screen.getByRole("button", { name: "Back" }))

    expect(router.back).toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
  })

  it("Back goes to the brokerage accounts when there is no page to return to", async () => {
    Object.defineProperty(window.history, "length", {
      configurable: true,
      value: 1,
    })
    render(<BrokerageImportPage />)

    await userEvent.click(screen.getByRole("button", { name: "Back" }))

    expect(router.push).toHaveBeenCalledWith("/brokers")
    expect(router.back).not.toHaveBeenCalled()
  })
})
