import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import useSwr from "swr"
import SectorWeightingsPopup from "../SectorWeightingsPopup"
import {
  makeAsset,
  makeSectorExposure,
  makeAssetHolding,
} from "@test-fixtures/beancounter"

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
}))
const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

const exposuresKey = (assetId: string): string =>
  `/api/classifications/${assetId}/exposures`
const holdingsKey = (assetId: string): string =>
  `/api/classifications/${assetId}/holdings`

interface MockSwrResult {
  data: unknown
  error: undefined
  isLoading: boolean
  isValidating: boolean
  mutate: jest.Mock
}

const swrResult = (data: unknown): MockSwrResult => ({
  data,
  error: undefined,
  isLoading: false,
  isValidating: false,
  mutate: jest.fn(),
})

/** Wire useSwr so exposures/holdings resolve to the given payloads by key. */
function mockSwr(
  assetId: string,
  exposures: unknown[] | undefined,
  holdings: unknown[] | undefined = [],
): void {
  mockUseSwr.mockImplementation((key: unknown) => {
    if (key === exposuresKey(assetId)) {
      return swrResult(
        exposures === undefined ? undefined : { data: exposures },
      ) as ReturnType<typeof useSwr>
    }
    if (key === holdingsKey(assetId)) {
      return swrResult(
        holdings === undefined ? undefined : { data: holdings },
      ) as ReturnType<typeof useSwr>
    }
    return swrResult(undefined) as ReturnType<typeof useSwr>
  })
}

describe("SectorWeightingsPopup", () => {
  const asset = makeAsset({
    id: "asset-etf",
    code: "VOO",
    name: "Vanguard S&P 500",
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("renders the effective as-at date as the max asOf across exposures", () => {
    mockSwr(asset.id, [
      makeSectorExposure({
        item: { name: "Information Technology", code: "IT" },
        asOf: "2026-08-01",
      }),
      makeSectorExposure({
        item: { name: "Health Care", code: "HC" },
        asOf: "2026-08-04",
      }),
    ])

    render(
      <SectorWeightingsPopup
        asset={asset}
        modalOpen={true}
        onClose={jest.fn()}
      />,
    )

    // Tolerant of locale ordering: formatDate uses toLocaleDateString(undefined, ...),
    // so the runner's locale decides "4 Aug 2026" vs "Aug 4, 2026".
    expect(screen.getByText(/As at .*Aug.*2026/)).toBeInTheDocument()
  })

  it("shows an honest empty state with last-checked date when classificationCheckedAt is present", () => {
    mockSwr(asset.id, [])
    const checkedAsset = makeAsset({
      id: "asset-lse",
      code: "IUQA",
      classificationCheckedAt: "2026-08-04",
    })

    render(
      <SectorWeightingsPopup
        asset={checkedAsset}
        modalOpen={true}
        onClose={jest.fn()}
      />,
    )

    expect(
      screen.getByText(/No sector data available\. Last checked .*Aug.*2026\./),
    ).toBeInTheDocument()
  })

  it("shows an honest empty state without a checked date when classificationCheckedAt is absent", () => {
    mockSwr(asset.id, [])
    const uncheckedAsset = makeAsset({ id: "asset-new", code: "NEWFUND" })

    render(
      <SectorWeightingsPopup
        asset={uncheckedAsset}
        modalOpen={true}
        onClose={jest.fn()}
      />,
    )

    expect(
      screen.getByText("Sector data has not been collected for this fund yet."),
    ).toBeInTheDocument()
  })

  it("does not render a blank panel when exposures are empty", () => {
    mockSwr(asset.id, [])

    render(
      <SectorWeightingsPopup
        asset={asset}
        modalOpen={true}
        onClose={jest.fn()}
      />,
    )

    expect(
      screen.getByText("Sector data has not been collected for this fund yet."),
    ).toBeInTheDocument()
  })
})

describe("SectorWeightingsPopup holdings tab asOf", () => {
  const asset = makeAsset({ id: "asset-etf2", code: "SPY" })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it("does not render an as-at caption when holdings carry no data (sectors tab active)", () => {
    mockSwr(asset.id, [makeSectorExposure({ asOf: "2026-08-04" })])

    render(
      <SectorWeightingsPopup
        asset={asset}
        modalOpen={true}
        onClose={jest.fn()}
      />,
    )

    // Only one as-at caption should appear (sectors tab is active by default)
    expect(screen.getAllByText(/As at/)).toHaveLength(1)
  })

  it("renders holdings-tab data with an asOf value carried on each row", () => {
    mockSwr(
      asset.id,
      [makeSectorExposure({ asOf: "2026-08-04" })],
      [makeAssetHolding({ symbol: "AAPL", asOf: "2026-08-04" })],
    )

    render(
      <SectorWeightingsPopup
        asset={asset}
        modalOpen={true}
        onClose={jest.fn()}
      />,
    )

    // Sanity: component renders without error with holdings asOf present.
    expect(screen.getByText("Sectors")).toBeInTheDocument()
  })
})

describe("SectorWeightingsPopup weight bars", () => {
  const asset = makeAsset({ id: "asset-bars", code: "SPY" })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const renderPopup = (): void => {
    render(
      <SectorWeightingsPopup
        asset={asset}
        modalOpen={true}
        onClose={jest.fn()}
      />,
    )
  }

  const barFor = (label: string): HTMLElement => {
    const row = screen.getByText(label).closest(".flex.items-center")
    return row?.querySelector(".transition-all") as HTMLElement
  }

  it("scales sector bars against the largest weight, heaviest first", () => {
    mockSwr(asset.id, [
      makeSectorExposure({
        item: { code: "EN", name: "Energy" },
        weight: 0.1,
      } as never),
      makeSectorExposure({
        item: { code: "IT", name: "Information Technology" },
        weight: 0.4,
      } as never),
    ])
    renderPopup()

    expect(barFor("Information Technology").style.width).toBe("100%")
    expect(barFor("Energy").style.width).toBe("25%")
    expect(barFor("Energy").style.backgroundColor).toBe("rgb(239, 68, 68)")
    expect(screen.getByText("40.0%")).toHaveClass(
      "w-16",
      "text-right",
      "text-sm",
      "font-medium",
      "text-gray-900",
    )
    expect(screen.getByText("Energy")).toHaveClass("w-32", "truncate", "pr-2")
  })

  it("shows symbol and optional name on holdings bars", () => {
    mockSwr(
      asset.id,
      [],
      [
        makeAssetHolding({ symbol: "AAPL", name: "Apple", weight: 0.08 }),
        makeAssetHolding({ symbol: "MSFT", name: undefined, weight: 0.02 }),
      ],
    )
    renderPopup()
    fireEvent.click(screen.getByText("Top Holdings"))

    expect(barFor("AAPL").style.width).toBe("100%")
    expect(barFor("MSFT").style.width).toBe("25%")
    expect(barFor("AAPL").style.backgroundColor).toBe("rgb(59, 130, 246)")
    expect(barFor("MSFT").style.backgroundColor).toBe("rgb(16, 185, 129)")
    expect(screen.getByText("Apple")).toHaveClass(
      "text-xs",
      "text-gray-500",
      "truncate",
    )
    expect(screen.getByText("AAPL").parentElement).toHaveClass(
      "w-32",
      "flex-shrink-0",
      "pr-2",
    )
    expect(screen.getByText("8.0%")).toBeInTheDocument()
  })
})
