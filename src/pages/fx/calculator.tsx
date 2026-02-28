import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/router"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import useSwr from "swr"
import { Currency, FxRequest, FxResponse } from "types/beancounter"
import { ccyKey, simpleFetcher } from "@utils/api/fetchHelper"
import MathInput from "@components/ui/MathInput"

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
    const router = useRouter()
    const [from, setFrom] = useState<string>("")
    const [to, setTo] = useState<string>("")

    const handleClose = useCallback((): void => {
      router.back()
    }, [router])

    const mountedRef = useRef(false)
    useEffect(() => {
      // Skip registering until after first render to avoid
      // stale keyboard events from the navigation triggering close.
      const timer = setTimeout(() => {
        mountedRef.current = true
      }, 100)
      return () => clearTimeout(timer)
    }, [])

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent): void => {
        if (e.key === "Escape" && mountedRef.current) handleClose()
      }
      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }, [handleClose])

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

    const fxKey = from && to && from !== to ? ["/api/fx", from, to] : null
    const { data: fxData, isLoading: fxLoading } = useSwr<FxResponse>(
      fxKey,
      ([url, f, t]: [string, string, string]) => fxFetcher(url, f, t),
    )

    const rateKey = from && to ? `${from}:${to}` : null
    const rate = rateKey ? fxData?.data?.rates?.[rateKey]?.rate : undefined

    const [amount, setAmount] = useState<number>(0)

    const handleSwap = (): void => {
      setFrom(to)
      setTo(from)
    }

    const result =
      amount > 0 && rate !== undefined
        ? (amount * rate).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : null

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget && mountedRef.current) handleClose()
        }}
      >
        <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-6 py-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">FX Calculator</h1>
                <p className="text-blue-100 text-sm mt-1">
                  Convert between currencies
                </p>
              </div>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Close calculator"
                className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {ccyLoading ? (
              <div className="flex justify-center py-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {/* Currency pair row */}
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-500">
                      From
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

                  <button
                    type="button"
                    onClick={handleSwap}
                    aria-label="Swap currencies"
                    className="mb-0.5 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <svg
                      className="w-4 h-4"
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

                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-500">
                      To
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

                {/* Rate display */}
                {rate !== undefined && from !== to && (
                  <p className="text-xs text-slate-400 tabular-nums text-center">
                    1 {from} = {rate.toFixed(4)} {to}
                  </p>
                )}

                {from === to && from !== "" && (
                  <p className="text-center text-sm text-slate-500">
                    Select different currencies
                  </p>
                )}

                {/* Amount and result */}
                {from !== to && from !== "" && (
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        {from}
                      </label>
                      <MathInput
                        value={amount || undefined}
                        onChange={setAmount}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Enter amount"
                      />
                    </div>

                    <span className="mb-2.5 text-slate-400 text-sm">=</span>

                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-slate-600">
                        {to}
                      </label>
                      <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm tabular-nums">
                        {fxLoading ? (
                          <span className="text-slate-400">Loading...</span>
                        ) : (
                          (result ?? "-")
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer hint */}
          <div className="bg-slate-50 px-6 py-2 border-t border-slate-100">
            <p className="text-[10px] text-slate-400">
              Press{" "}
              <kbd className="px-1 bg-slate-200 rounded text-[10px]">Esc</kbd>{" "}
              to close
            </p>
          </div>
        </div>
      </div>
    )
  },
)
