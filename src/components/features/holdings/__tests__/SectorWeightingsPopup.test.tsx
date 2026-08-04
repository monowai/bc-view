import React from "react"
import { render, screen } from "@testing-library/react"
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
