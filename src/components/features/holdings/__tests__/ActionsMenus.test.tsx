import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { ActionsMenu, CashActionsMenu } from "../ActionsMenus"
import { makeAsset, makeWatchlistItem } from "@test-fixtures/beancounter"
import { useWatchlist } from "@hooks/useWatchlist"
import { removeWatchlistItem } from "@utils/api/client/watchlist"

jest.mock("@hooks/useWatchlist")
jest.mock("swr", () => ({ mutate: jest.fn() }))
jest.mock("@utils/api/client/watchlist", () => ({
  ...jest.requireActual("@utils/api/client/watchlist"),
  removeWatchlistItem: jest.fn(),
}))
beforeEach(() => {
  ;(useWatchlist as jest.Mock).mockReturnValue({ items: [] })
})

let capturedWatchlistProps: Record<string, unknown> | null = null
jest.mock("@components/features/watchlists/AddToWatchlistDialog", () => {
  return function AddToWatchlistDialog(props: Record<string, unknown>) {
    capturedWatchlistProps = props
    return <input aria-label="watchlist dialog field" />
  }
})

const asset = makeAsset({ id: "asset-aapl", code: "AAPL" })

const baseProps = {
  asset,
  portfolioId: "ctx",
  portfolioCode: "CTX",
  quantity: 10,
  price: 100,
  costBasis: 900,
  tradeCurrency: { code: "USD", symbol: "$", name: "Dollar" },
  valueIn: "PORTFOLIO",
}

const openMenu = (): void => {
  fireEvent.click(screen.getByRole("button", { name: /Actions AAPL/i }))
}

describe("ActionsMenu", () => {
  it("offers Analyse my holding when given a handler and calls it", () => {
    const onAnalyseHolding = jest.fn()
    render(<ActionsMenu {...baseProps} onAnalyseHolding={onAnalyseHolding} />)
    openMenu()
    fireEvent.click(screen.getByRole("button", { name: "Analyse my holding" }))
    expect(onAnalyseHolding).toHaveBeenCalledTimes(1)
  })

  it("omits Analyse my holding without a handler", () => {
    render(<ActionsMenu {...baseProps} onTrade={jest.fn()} />)
    openMenu()
    expect(
      screen.queryByRole("button", { name: "Analyse my holding" }),
    ).not.toBeInTheDocument()
  })

  it("includes the asset id in the trade payload so the page can resolve the portfolio", () => {
    const onTrade = jest.fn()
    render(<ActionsMenu {...baseProps} onTrade={onTrade} />)
    openMenu()
    fireEvent.click(screen.getByRole("button", { name: "Trade" }))
    expect(onTrade).toHaveBeenCalledWith(
      expect.objectContaining({ asset: "AAPL", assetId: "asset-aapl" }),
    )
  })

  it("renders Go to portfolio and calls onGoToPortfolio with the asset", () => {
    const onGoToPortfolio = jest.fn()
    render(<ActionsMenu {...baseProps} onGoToPortfolio={onGoToPortfolio} />)
    openMenu()
    fireEvent.click(screen.getByRole("button", { name: "Go to portfolio" }))
    expect(onGoToPortfolio).toHaveBeenCalledWith(asset)
  })

  it("omits Go to portfolio when no handler is provided", () => {
    render(<ActionsMenu {...baseProps} onTrade={jest.fn()} />)
    openMenu()
    expect(
      screen.queryByRole("button", { name: "Go to portfolio" }),
    ).not.toBeInTheDocument()
  })

  it("shows View Sectors for an ETF", () => {
    const etfAsset = makeAsset({
      id: "asset-etf",
      code: "VOO",
      assetCategory: { id: "ETF", name: "ETF" },
    })
    render(
      <ActionsMenu
        {...baseProps}
        asset={etfAsset}
        onSectorWeightings={jest.fn()}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /Actions VOO/i }))
    expect(
      screen.getByRole("button", { name: "View Sectors" }),
    ).toBeInTheDocument()
  })

  it("shows View Sectors for a MUTUAL FUND (LSE/LON-listed UCITS funds)", () => {
    const fundAsset = makeAsset({
      id: "asset-iuqa",
      code: "IUQA",
      assetCategory: { id: "MUTUAL FUND", name: "Mutual Fund" },
    })
    render(
      <ActionsMenu
        {...baseProps}
        asset={fundAsset}
        onSectorWeightings={jest.fn()}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /Actions IUQA/i }))
    expect(
      screen.getByRole("button", { name: "View Sectors" }),
    ).toBeInTheDocument()
  })

  it("omits View Sectors for a non-fund category such as EQUITY", () => {
    render(<ActionsMenu {...baseProps} onSectorWeightings={jest.fn()} />)
    openMenu()
    expect(
      screen.queryByRole("button", { name: "View Sectors" }),
    ).not.toBeInTheDocument()
  })
})

describe("menu behaviour shared by both menus", () => {
  const cashProps = {
    asset: makeAsset({ id: "asset-dbs", code: "DBS" }),
    portfolio: { id: "p1", code: "SGD" },
    marketValue: 1000,
  }

  it.each([
    [
      "ActionsMenu",
      () => <ActionsMenu {...baseProps} onTrade={jest.fn()} />,
      /Actions AAPL/i,
      "Trade",
    ],
    [
      "CashActionsMenu",
      () => <CashActionsMenu {...cashProps} onGoToPortfolio={jest.fn()} />,
      /Actions DBS/i,
      "Go to portfolio",
    ],
  ])(
    "%s opens on the trigger, closes on a pick, and hides the click from the row",
    (_name, menu, trigger, item) => {
      const onRowClick = jest.fn()
      render(<div onClick={onRowClick}>{menu()}</div>)

      expect(
        screen.queryByRole("button", { name: item }),
      ).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole("button", { name: trigger }))
      fireEvent.click(screen.getByRole("button", { name: item }))

      expect(
        screen.queryByRole("button", { name: item }),
      ).not.toBeInTheDocument()
      expect(onRowClick).not.toHaveBeenCalled()
    },
  )
})

describe("ActionsMenu — watchlist", () => {
  beforeEach(() => {
    capturedWatchlistProps = null
  })

  it("offers to edit the watch target when the asset is already watched", () => {
    ;(useWatchlist as jest.Mock).mockReturnValue({
      items: [makeWatchlistItem({ asset, targetPrice: null })],
    })
    render(<ActionsMenu {...baseProps} onTrade={jest.fn()} />)
    openMenu()

    expect(
      screen.queryByRole("button", { name: "Add to Watchlist" }),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Edit watch target" }))

    expect(screen.getByLabelText(/Target price/)).toHaveValue("")
    expect(capturedWatchlistProps).toBeNull()
  })

  it("opens the add-to-watchlist dialog for the holding's asset", () => {
    render(<ActionsMenu {...baseProps} onTrade={jest.fn()} />)
    openMenu()
    fireEvent.click(screen.getByRole("button", { name: "Add to Watchlist" }))

    expect(capturedWatchlistProps?.asset).toEqual({
      id: "asset-aapl",
      label: "AAPL",
    })
  })

  it("keeps clicks inside the dialog from reaching the holding row", () => {
    const onRowDoubleClick = jest.fn()
    const onRowClick = jest.fn()
    render(
      <div onDoubleClick={onRowDoubleClick} onClick={onRowClick}>
        <ActionsMenu {...baseProps} onTrade={jest.fn()} />
      </div>,
    )
    openMenu()
    fireEvent.click(screen.getByRole("button", { name: "Add to Watchlist" }))
    onRowClick.mockClear()

    const field = screen.getByLabelText("watchlist dialog field")
    fireEvent.click(field)
    fireEvent.doubleClick(field)

    expect(onRowClick).not.toHaveBeenCalled()
    expect(onRowDoubleClick).not.toHaveBeenCalled()
  })

  it("offers no watch action until the watchlist has loaded", () => {
    ;(useWatchlist as jest.Mock).mockReturnValue({ items: undefined })
    render(<ActionsMenu {...baseProps} onTrade={jest.fn()} />)
    openMenu()

    expect(
      screen.queryByRole("button", { name: "Add to Watchlist" }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Edit watch target" }),
    ).not.toBeInTheDocument()
  })

  it("does not offer an asset the server marks unwatchable", () => {
    render(
      <ActionsMenu
        {...baseProps}
        asset={makeAsset({ id: "pa-1", code: "AAPL", watchable: false })}
        onTrade={jest.fn()}
      />,
    )
    openMenu()

    expect(
      screen.queryByRole("button", { name: "Add to Watchlist" }),
    ).not.toBeInTheDocument()
  })
})

describe("ActionsMenu — remove from watchlist", () => {
  const watchedItem = makeWatchlistItem({ id: "wi-1", asset })
  const question = "Remove AAPL from your watchlist?"

  beforeEach(() => {
    ;(useWatchlist as jest.Mock).mockReturnValue({ items: [watchedItem] })
    ;(removeWatchlistItem as jest.Mock).mockReset()
  })

  const openRemove = (): void => {
    render(<ActionsMenu {...baseProps} onTrade={jest.fn()} />)
    openMenu()
    fireEvent.click(screen.getByRole("button", { name: "Edit watch target" }))
    fireEvent.click(
      screen.getByRole("button", { name: "Remove from watchlist" }),
    )
  }

  it("offers one watch item in the menu", () => {
    render(<ActionsMenu {...baseProps} onTrade={jest.fn()} />)
    openMenu()

    const watchItems = screen.getAllByRole("button", { name: /watch/i })
    expect(watchItems.map((b) => b.textContent)).toEqual(["Edit watch target"])
  })

  it("removes a watched asset from the edit dialog after confirmation", async () => {
    ;(removeWatchlistItem as jest.Mock).mockResolvedValue(undefined)
    openRemove()

    expect(screen.getByText(question)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))

    await waitFor(() =>
      expect(removeWatchlistItem).toHaveBeenCalledWith("wi-1"),
    )
    await waitFor(() =>
      expect(screen.queryByText(question)).not.toBeInTheDocument(),
    )
    expect(screen.queryByLabelText(/Target price/)).not.toBeInTheDocument()
  })

  it("keeps the dialog open with the error when removal fails", async () => {
    ;(removeWatchlistItem as jest.Mock).mockRejectedValue(
      new Error("Remove failed: 500"),
    )
    openRemove()
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))

    expect(await screen.findByText("Remove failed: 500")).toBeInTheDocument()
    expect(screen.getByText(question)).toBeInTheDocument()
  })

  it("returns to the edit dialog when the removal is cancelled", () => {
    openRemove()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))

    expect(removeWatchlistItem).not.toHaveBeenCalled()
    expect(screen.queryByText(question)).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Target price/)).toBeInTheDocument()
  })
})

describe("CashActionsMenu", () => {
  const cashAsset = makeAsset({ id: "asset-dbs", code: "DBS" })
  const cashProps = {
    asset: cashAsset,
    portfolio: { id: "p1", code: "SGD" },
    marketValue: 1000,
    tradeCurrency: { code: "SGD", symbol: "$", name: "Singapore Dollar" },
  }
  const openCashMenu = (): void => {
    fireEvent.click(screen.getByRole("button", { name: /Actions DBS/i }))
  }

  it("renders Exchange Cash and opens the cash transaction seeded with FX", () => {
    const onCashTransaction = jest.fn()
    render(
      <CashActionsMenu {...cashProps} onCashTransaction={onCashTransaction} />,
    )
    openCashMenu()
    fireEvent.click(screen.getByRole("button", { name: "Exchange Cash" }))
    expect(onCashTransaction).toHaveBeenCalledWith("DBS", "FX")
  })

  it("Cash Transaction opens with no preset type (default deposit)", () => {
    const onCashTransaction = jest.fn()
    render(
      <CashActionsMenu {...cashProps} onCashTransaction={onCashTransaction} />,
    )
    openCashMenu()
    fireEvent.click(screen.getByRole("button", { name: "Cash Transaction" }))
    expect(onCashTransaction).toHaveBeenCalledWith("DBS")
  })
})
