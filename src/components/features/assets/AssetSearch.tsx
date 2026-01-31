import React, { useCallback, useRef, useState } from "react"
import { Controller, Control } from "react-hook-form"
import AsyncSelect from "react-select/async"
import { useTranslation } from "next-i18next"
import { AssetOption, AssetSearchResult } from "types/beancounter"
import { parseSearchInput } from "./parseSearchInput"

const EXPAND_SENTINEL = "__expand_search__"

interface AssetSearchProps {
  onSelect: (option: AssetOption | null) => void
  market?: string
  knownMarkets?: string[]
  name?: string
  control?: Control<any>
  value?: AssetOption | null
  defaultValue?: string
  placeholder?: string
  isClearable?: boolean
  filterResults?: (results: AssetOption[]) => AssetOption[]
}

function toOption(
  result: AssetSearchResult,
  showMarket: boolean,
): AssetOption {
  return {
    value: result.assetId || result.symbol,
    label: showMarket
      ? `${result.symbol} - ${result.name} (${result.market || result.region})`
      : `${result.symbol} - ${result.name}`,
    symbol: result.symbol,
    name: result.name,
    market: result.market || result.region,
    assetId: result.assetId,
    currency: result.currency,
    type: result.type,
    region: result.region,
  }
}

/**
 * Unified asset search component wrapping react-select/async.
 *
 * Search behaviour:
 * - Specific market (market prop is set and not "LOCAL"): search that market directly.
 * - LOCAL / unset: search LOCAL first, show "Expand Search?" sentinel,
 *   auto-expand to FIGI if LOCAL returns nothing.
 */
export default function AssetSearch({
  onSelect,
  market,
  knownMarkets,
  name,
  control,
  value,
  defaultValue,
  placeholder,
  isClearable = true,
  filterResults,
}: AssetSearchProps): React.ReactElement {
  const { t } = useTranslation("common")
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const [isExpanding, setIsExpanding] = useState(false)
  const lastKeywordRef = useRef("")
  const lastMarketRef = useRef("")
  const localResultsRef = useRef<AssetOption[]>([])
  const callbackRef = useRef<((options: AssetOption[]) => void) | null>(null)

  const isSpecificMarket =
    market !== undefined && market !== "LOCAL" && market !== ""

  const doFetch = useCallback(
    async (
      keyword: string,
      searchMarket: string,
    ): Promise<AssetSearchResult[]> => {
      const params = new URLSearchParams({
        keyword,
        market: searchMarket,
      })
      const response = await fetch(`/api/assets/search?${params}`)
      if (!response.ok) return []
      const data = await response.json()
      return data.data || []
    },
    [],
  )

  const loadOptions = useCallback(
    (inputValue: string, callback: (options: AssetOption[]) => void): void => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      // Parse MARKET:KEYWORD syntax
      const parsed = parseSearchInput(
        inputValue,
        knownMarkets,
        isSpecificMarket ? market : "LOCAL",
      )

      if (!parsed.validMarket || parsed.keyword.length < 2) {
        callback([])
        return
      }

      lastKeywordRef.current = parsed.keyword
      lastMarketRef.current = parsed.market

      debounceRef.current = setTimeout(async () => {
        try {
          const isLocalSearch =
            !isSpecificMarket && parsed.market === "LOCAL"

          const results = await doFetch(parsed.keyword, parsed.market)
          const showMarket = parsed.market === "LOCAL" || parsed.market === "FIGI"
          let options = results.map((r) => toOption(r, showMarket))

          if (filterResults) {
            options = filterResults(options)
          }

          if (isLocalSearch) {
            localResultsRef.current = options
            if (options.length === 0) {
              // Auto-expand to FIGI
              setIsExpanding(true)
              const figiResults = await doFetch(parsed.keyword, "FIGI")
              let figiOptions = figiResults.map((r) => toOption(r, true))
              if (filterResults) {
                figiOptions = filterResults(figiOptions)
              }
              setIsExpanding(false)
              callback(figiOptions)
            } else {
              // Show local results with expand sentinel
              const expandOption: AssetOption = {
                value: EXPAND_SENTINEL,
                label: t("trn.asset.search.expandSearch", "Expand Search?"),
                symbol: "",
              }
              callback([...options, expandOption])
            }
          } else {
            // Specific market or parsed market from MARKET:KEYWORD
            callback(options)
          }
        } catch {
          callback([])
        }
      }, 300)
    },
    [market, knownMarkets, isSpecificMarket, doFetch, filterResults, t],
  )

  const handleExpandSearch = useCallback(async (): Promise<void> => {
    const keyword = lastKeywordRef.current
    if (!keyword || keyword.length < 2) return

    setIsExpanding(true)
    try {
      const figiResults = await doFetch(keyword, "FIGI")
      let figiOptions = figiResults.map((r) => toOption(r, true))
      if (filterResults) {
        figiOptions = filterResults(figiOptions)
      }

      // Merge: local + FIGI (dedup by symbol:market)
      const existingKeys = new Set(
        localResultsRef.current.map((o) => `${o.symbol}:${o.market}`),
      )
      const newOptions = figiOptions.filter(
        (o) => !existingKeys.has(`${o.symbol}:${o.market}`),
      )
      const merged = [...localResultsRef.current, ...newOptions]

      // Update the pending callback
      callbackRef.current?.(merged)
    } catch {
      // Keep existing results
      callbackRef.current?.(localResultsRef.current)
    } finally {
      setIsExpanding(false)
    }
  }, [doFetch, filterResults])

  const handleChange = useCallback(
    (selected: AssetOption | null): void => {
      if (selected?.value === EXPAND_SENTINEL) {
        handleExpandSearch()
        return
      }
      onSelect(selected)
    },
    [onSelect, handleExpandSearch],
  )

  const formatOptionLabel = useCallback(
    (option: AssetOption): React.ReactNode => {
      if (option.value === EXPAND_SENTINEL) {
        return (
          <div className="text-center text-blue-600 font-medium text-sm">
            {isExpanding ? (
              <span>
                <i className="fas fa-spinner fa-spin mr-2"></i>
                {t("trn.asset.search.loading", "Searching...")}
              </span>
            ) : (
              <span>
                <i className="fas fa-search-plus mr-1"></i>
                {t("trn.asset.search.expandSearch", "Expand Search?")}
              </span>
            )}
          </div>
        )
      }
      return option.label
    },
    [isExpanding, t],
  )

  const noOptionsMessage = useCallback(
    ({ inputValue }: { inputValue: string }): string => {
      if (knownMarkets) {
        const parsed = parseSearchInput(inputValue, knownMarkets)
        if (!parsed.validMarket) {
          return t(
            "assets.lookup.unknownMarket",
            `Market "{{market}}" is not supported`,
            { market: parsed.market },
          )
        }
      }
      return inputValue.length < 2
        ? t("trn.asset.search.minChars", "Type at least 2 characters")
        : t("trn.asset.search.noResults", "No assets found")
    },
    [knownMarkets, t],
  )

  const selectProps = {
    cacheOptions: false as const,
    loadOptions,
    placeholder: placeholder || t("trn.asset.search.placeholder"),
    noOptionsMessage,
    loadingMessage: () => t("trn.asset.search.loading", "Searching..."),
    onChange: handleChange,
    isClearable,
    formatOptionLabel,
    menuPortalTarget:
      typeof document !== "undefined" ? document.body : null,
    menuPosition: "fixed" as const,
    styles: {
      control: (base: Record<string, unknown>) => ({
        ...base,
        minHeight: "38px",
      }),
      menuPortal: (base: Record<string, unknown>) => ({
        ...base,
        zIndex: 9999,
      }),
    },
  }

  // Form mode: wrap in Controller
  if (name && control) {
    return (
      <Controller
        name={name}
        control={control}
        render={({ field }) => (
          <AsyncSelect<AssetOption>
            {...selectProps}
            {...field}
            onChange={(selected: AssetOption | null) => {
              field.onChange(selected?.value || "")
              handleChange(selected)
            }}
            value={
              field.value
                ? { value: field.value, label: field.value, symbol: field.value }
                : defaultValue
                  ? { value: defaultValue, label: defaultValue, symbol: defaultValue }
                  : null
            }
          />
        )}
      />
    )
  }

  // Standalone mode
  return (
    <AsyncSelect<AssetOption>
      {...selectProps}
      value={value}
    />
  )
}
