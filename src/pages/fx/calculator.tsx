import React, { useEffect, useMemo, useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import useSwr from "swr"
import { Currency, FxRequest, FxResponse } from "types/beancounter"
import { ccyKey, simpleFetcher } from "@utils/api/fetchHelper"
import FxConverter from "@components/features/fx/FxConverter"

const fxFetcher = async (
  url: string,
  from: string,
  to: string,
): Promise<FxResponse> => {
  const body: FxRequest = { pairs: [{ from, to }] }
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!response.ok)
    throw new Error(`Failed to fetch FX rate: ${response.status}`)
  return response.json()
}

export default withPageAuthRequired(
  function FxCalculator(): React.ReactElement {
    const [from, setFrom] = useState<string>("")
    const [to, setTo] = useState<string>("")

    const { data: ccyResponse, isLoading: ccyLoading } = useSwr<{
      data: Currency[]
    }>(ccyKey, simpleFetcher(ccyKey))

    const currencies = useMemo(
      () => ccyResponse?.data || [],
      [ccyResponse?.data],
    )

    useEffect(() => {
      if (currencies.length > 0 && !from) {
        const codes = currencies.map((c) => c.code)
        const defaultFrom = codes.includes("USD") ? "USD" : codes[0]
        const defaultTo = codes.includes("EUR")
          ? "EUR"
          : codes.find((c) => c !== defaultFrom) || codes[0]
        setFrom(defaultFrom)
        setTo(defaultTo)
      }
    }, [currencies, from])

    const fxKey =
      from && to && from !== to ? ["/api/fx", from, to] : null
    const { data: fxData, isLoading: fxLoading } = useSwr<FxResponse>(
      fxKey,
      ([url, f, t]: [string, string, string]) => fxFetcher(url, f, t),
    )

    const rateKey = from && to ? `${from}/${to}` : null
    const rate = rateKey ? fxData?.data?.rates?.[rateKey]?.rate : undefined

    const handleSwap = (): void => {
      setFrom(to)
      setTo(from)
    }

    return (
      <div className="max-w-md mx-auto mt-12 px-4">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-5 text-white">
            <h1 className="text-xl font-bold">{"FX Calculator"}</h1>
            <p className="text-blue-100 text-sm mt-1">
              {"Convert between currencies"}
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Currency selectors */}
            {ccyLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* From selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    {"From"}
                  </label>
                  <select
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Swap button */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleSwap}
                    aria-label="Swap currencies"
                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <svg
                      className="w-5 h-5 text-slate-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                      />
                    </svg>
                  </button>
                </div>

                {/* To selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    {"To"}
                  </label>
                  <select
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {currencies.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.code} - {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* FX Converter or status message */}
            {from === to && from !== "" && (
              <p className="text-center text-sm text-slate-500">
                {"Select different currencies"}
              </p>
            )}

            {fxLoading && from !== to && (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            )}

            {rate !== undefined && from !== to && (
              <FxConverter
                from={from}
                to={to}
                rate={rate}
                onSwap={handleSwap}
              />
            )}
          </div>
        </div>
      </div>
    )
  },
)
