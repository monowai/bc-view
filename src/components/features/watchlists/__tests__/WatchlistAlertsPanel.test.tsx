import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import WatchlistAlertsPanel, {
  WATCHLIST_ALERTS_ANCHOR,
} from "@components/features/watchlists/WatchlistAlertsPanel"
import { makeAsset, makeWatchlistAlert } from "@test-fixtures/beancounter"
import { formatDate } from "@lib/formatters"

const rose = makeWatchlistAlert({
  id: "wa-1",
  asset: makeAsset({ id: "asset-1", code: "AAA", name: "Alpha Corp" }),
  direction: "ABOVE",
  targetPrice: 12.5,
  close: 13.25,
  priceDate: "2026-03-04",
})

const fell = makeWatchlistAlert({
  id: "wa-2",
  itemId: "wi-2",
  asset: makeAsset({ id: "asset-2", code: "BBB", name: "Beta Ltd" }),
  currency: { code: "GBP", name: "Pound", symbol: "£" },
  direction: "BELOW",
  targetPrice: 7,
  close: 6.75,
  priceDate: "2026-03-05",
})

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response
}

describe("WatchlistAlertsPanel", () => {
  it("renders nothing when there are no alerts", () => {
    const { container } = render(
      <WatchlistAlertsPanel alerts={[]} onDismissed={jest.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("says a rise to target with the close, currency and price date", () => {
    render(<WatchlistAlertsPanel alerts={[rose]} onDismissed={jest.fn()} />)

    const row = screen.getByTestId("watchlist-alert-wa-1")
    expect(row).toHaveTextContent("AAA")
    expect(row).toHaveTextContent("Alpha Corp")
    expect(row).toHaveTextContent(/rose to 12\.50/i)
    expect(row).toHaveTextContent(/closed 13\.25\s*USD/i)
    expect(row).toHaveTextContent(formatDate("2026-03-04"))
  })

  it("says a fall to target in the alert's own currency", () => {
    render(<WatchlistAlertsPanel alerts={[fell]} onDismissed={jest.fn()} />)

    const row = screen.getByTestId("watchlist-alert-wa-2")
    expect(row).toHaveTextContent(/fell to 7\.00/i)
    expect(row).toHaveTextContent(/closed 6\.75\s*GBP/i)
    expect(row).toHaveTextContent(formatDate("2026-03-05"))
    expect(row).not.toHaveTextContent(/rose to/i)
  })

  it("dismisses through DELETE and hands back the remaining alerts", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(200, { data: [fell] }))
    global.fetch = fetchMock as unknown as typeof fetch
    const onDismissed = jest.fn()
    render(
      <WatchlistAlertsPanel alerts={[rose, fell]} onDismissed={onDismissed} />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Dismiss AAA alert" }))

    await waitFor(() => expect(onDismissed).toHaveBeenCalledWith([fell]))
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/watchlist/alerts/wa-1",
      expect.objectContaining({ method: "DELETE" }),
    )
  })

  it("shows the server's reason when a dismiss fails", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(404, { message: "alert not found" }),
      ) as unknown as typeof fetch
    const onDismissed = jest.fn()
    render(<WatchlistAlertsPanel alerts={[rose]} onDismissed={onDismissed} />)

    fireEvent.click(screen.getByRole("button", { name: "Dismiss AAA alert" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "alert not found",
    )
    expect(onDismissed).not.toHaveBeenCalled()
  })

  it("re-enables Dismiss once a dismiss settles and the row is still shown", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        jsonResponse(200, { data: [rose] }),
      ) as unknown as typeof fetch
    const onDismissed = jest.fn()
    render(<WatchlistAlertsPanel alerts={[rose]} onDismissed={onDismissed} />)

    const button = screen.getByRole("button", { name: "Dismiss AAA alert" })
    fireEvent.click(button)

    await waitFor(() => expect(onDismissed).toHaveBeenCalledWith([rose]))
    await waitFor(() => expect(button).toBeEnabled())
  })

  it("falls back to a generic reason when the failure is not an Error", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue("network down") as unknown as typeof fetch
    render(<WatchlistAlertsPanel alerts={[rose]} onDismissed={jest.fn()} />)

    const button = screen.getByRole("button", { name: "Dismiss AAA alert" })
    fireEvent.click(button)

    expect(await screen.findByRole("alert")).toHaveTextContent("Dismiss failed")
    expect(button).toBeEnabled()
  })

  it("anchors the panel on the shared alerts id", () => {
    render(<WatchlistAlertsPanel alerts={[rose]} onDismissed={jest.fn()} />)

    expect(
      screen.getByRole("region", { name: "Target alerts" }),
    ).toHaveAttribute("id", WATCHLIST_ALERTS_ANCHOR)
  })
})
