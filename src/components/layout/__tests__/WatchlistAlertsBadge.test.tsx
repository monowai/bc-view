import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { SWRConfig } from "swr"
import WatchlistAlertsBadge from "@components/layout/WatchlistAlertsBadge"
import { makeWatchlistAlert } from "@test-fixtures/beancounter"
import { WatchlistAlert } from "types/beancounter"

const mockRegistration = { isRegistered: true, isChecking: false }
jest.mock("@contexts/RegistrationContext", () => ({
  useRegistration: () => mockRegistration,
}))

let alerts: WatchlistAlert[]
let fetchMock: jest.Mock

beforeEach(() => {
  mockRegistration.isRegistered = true
  mockRegistration.isChecking = false
  alerts = []
  fetchMock = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: alerts }),
    }),
  )
  global.fetch = fetchMock as unknown as typeof fetch
})

function renderBadge(): ReturnType<typeof render> {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <WatchlistAlertsBadge />
    </SWRConfig>,
  )
}

describe("WatchlistAlertsBadge", () => {
  it("shows the alert count and links to the watchlist alerts", async () => {
    alerts = [
      makeWatchlistAlert({ id: "wa-1" }),
      makeWatchlistAlert({ id: "wa-2", direction: "BELOW" }),
    ]
    renderBadge()

    const link = await screen.findByRole("link", {
      name: /2 watchlist target alerts/i,
    })
    expect(link).toHaveAttribute("href", "/watchlist#alerts")
    expect(link).toHaveTextContent("2")
    expect(fetchMock).toHaveBeenCalledWith("/api/watchlist/alerts")
  })

  it("is hidden when there are no alerts", async () => {
    const { container } = renderBadge()

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
    expect(container).toBeEmptyDOMElement()
  })

  it("does not fetch for an unregistered user", () => {
    mockRegistration.isRegistered = false
    const { container } = renderBadge()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(container).toBeEmptyDOMElement()
  })
})
