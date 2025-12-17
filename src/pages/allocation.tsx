import React, { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/router"
import useSwr from "swr"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { errorOut } from "@components/errors/ErrorOut"
import { rootLoader } from "@components/ui/PageLoader"
import { Currency, FxResponse, HoldingContract } from "types/beancounter"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import {
  transformToAllocationSlices,
  GroupingMode,
} from "@lib/allocation/aggregateHoldings"
import AllocationChart from "@components/features/allocation/AllocationChart"
import AllocationControls from "@components/features/allocation/AllocationControls"

export default withPageAuthRequired(function Allocation(): React.ReactElement {
  const { t, ready } = useTranslation("common")
  const router = useRouter()

  // Get portfolio codes from URL query parameter
  const codes = router.query.codes as string | undefined
  const portfolioCodes = useMemo(() => (codes ? codes.split(",") : []), [codes])

  // Build the API URL with optional codes parameter
  const aggregatedHoldingsKey = codes
    ? `/api/holdings/aggregated?asAt=today&codes=${encodeURIComponent(codes)}`
    : "/api/holdings/aggregated?asAt=today"

  const [groupBy, setGroupBy] = useState<GroupingMode>("category")
  const [valueIn, setValueIn] = useState<ValueIn>(ValueIn.PORTFOLIO)

  // Currency display state (same pattern as portfolios)
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [displayCurrency, setDisplayCurrency] = useState<Currency | null>(null)
  const [baseCurrency, setBaseCurrency] = useState<Currency | null>(null)
  const [fxRate, setFxRate] = useState<number>(1)

  const { data, error, isLoading } = useSwr<{ data: HoldingContract }>(
    aggregatedHoldingsKey,
    simpleFetcher(aggregatedHoldingsKey),
  )

  // Fetch available currencies
  useEffect(() => {
    fetch("/api/currencies")
      .then((res) => res.json())
      .then((result) => {
        if (result.data) {
          setCurrencies(result.data)
        }
      })
      .catch(console.error)
  }, [])

  // Set default display currency from portfolio's currency
  useEffect(() => {
    if (data?.data?.portfolio?.currency && !baseCurrency) {
      const portfolioCurrency = data.data.portfolio.currency
      setBaseCurrency(portfolioCurrency)
      setDisplayCurrency(portfolioCurrency)
    }
  }, [data, baseCurrency])

  // Fetch FX rate when display currency changes
  useEffect(() => {
    if (!baseCurrency || !displayCurrency) return
    if (baseCurrency.code === displayCurrency.code) {
      setFxRate(1)
      return
    }

    fetch("/api/fx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rateDate: "today",
        pairs: [{ from: baseCurrency.code, to: displayCurrency.code }],
      }),
    })
      .then((res) => res.json())
      .then((fxResponse: FxResponse) => {
        const pairKey = `${baseCurrency.code}:${displayCurrency.code}`
        const rate = fxResponse.data?.rates?.[pairKey]?.rate
        if (rate) {
          setFxRate(rate)
        }
      })
      .catch(console.error)
  }, [baseCurrency, displayCurrency])

  const allocationData = useMemo(() => {
    if (!data?.data) return []
    const slices = transformToAllocationSlices(data.data, groupBy, valueIn)
    // Apply FX rate to values
    return slices.map((slice) => ({
      ...slice,
      value: slice.value * fxRate,
    }))
  }, [data, groupBy, valueIn, fxRate])

  const totalValue = useMemo(() => {
    return allocationData.reduce((sum, slice) => sum + slice.value, 0)
  }, [allocationData])

  const currencySymbol = useMemo(() => {
    return displayCurrency?.symbol || "$"
  }, [displayCurrency])

  // Determine the subtitle based on selected portfolios
  const subtitle = useMemo(() => {
    if (portfolioCodes.length === 0) {
      return t(
        "allocation.description.all",
        "Showing allocation across all portfolios",
      )
    }
    if (portfolioCodes.length === 1) {
      return t("allocation.description.single", "Showing allocation for {{code}}", {
        code: portfolioCodes[0],
      })
    }
    return t(
      "allocation.description.selected",
      "Showing allocation for {{count}} portfolios: {{codes}}",
      {
        count: portfolioCodes.length,
        codes: portfolioCodes.join(", "),
      },
    )
  }, [portfolioCodes, t])

  if (error) {
    return errorOut(
      t("allocation.error.retrieve", "Failed to load allocation data"),
      error,
    )
  }

  if (!ready || isLoading) {
    return rootLoader(t("loading"))
  }

  return (
    <div className="w-full py-4">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("allocation.title", "Asset Allocation")}
          </h1>
          <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
        </div>
        {currencies.length > 0 && displayCurrency && (
          <select
            value={displayCurrency.code}
            onChange={(e) => {
              const selected = currencies.find((c) => c.code === e.target.value)
              if (selected) setDisplayCurrency(selected)
            }}
            className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            title={t("portfolios.currency.display")}
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol}
                {c.code}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-6">
        <AllocationControls
          groupBy={groupBy}
          onGroupByChange={setGroupBy}
          valueIn={valueIn}
          onValueInChange={setValueIn}
        />

        <AllocationChart
          data={allocationData}
          totalValue={totalValue}
          currencySymbol={currencySymbol}
        />
      </div>
    </div>
  )
})

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
