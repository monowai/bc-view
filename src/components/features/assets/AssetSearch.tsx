import React, { useCallback, useRef, useState } from "react"
import { Controller, Control } from "react-hook-form"
import AsyncSelect from "react-select/async"
import { AssetOption, AssetSearchResult } from "types/beancounter"
import { stripOwnerPrefix } from "@lib/assets/assetUtils"
import { parseSearchInput } from "./parseSearchInput"

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
  noResultsHref?: string
  inputId?: string
  /**
   * Render the dropdown via a fixed-position body portal. Required when the
   * search lives inside an element with `overflow: hidden` (e.g. a Dialog).
   * Avoid in plain page layouts on mobile — iOS Safari positions
   * `position: fixed` against the layout viewport, so when the keyboard
   * shrinks the visual viewport the menu drifts up over the input.
   */
  usePortal?: boolean
}

function toOption(result: AssetSearchResult): AssetOption {
  const market = result.market || result.region
  const details = [market, result.type].filter(Boolean).join(", ")
  const label = details
    ? `${result.symbol} - ${result.name} (${details})`
    : `${result.symbol} - ${result.name}`
  return {
    value: result.assetId || result.symbol,
    label,
    symbol: result.symbol,
    name: result.name,
    market,
    assetId: result.assetId,
    currency: result.currency,
    type: result.type,
    region: result.region,
  }
}

/**
 * Asset search component wrapping react-select/async.
 *
 * Search behaviour:
 * - User types keyword (or MARKET:KEYWORD) → backend returns results → display.
 * - Backend handles local DB + external provider merge.
 * - Cross-market search: use FIGI:keyword syntax.
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
  noResultsHref,
  inputId,
  usePortal = false,
}: AssetSearchProps): React.ReactElement {
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const [inputText, setInputText] = useState("")
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = useState<AssetOption | null>(null)
  const lastSelectedRef = useRef<AssetOption | null>(null)
  const displayValue = isControlled ? value : internalValue

  const isSpecificMarket = market !== undefined && market !== ""

  const doFetch = useCallback(
    async (
      keyword: string,
      searchMarket: string,
    ): Promise<AssetSearchResult[]> => {
      const params = new URLSearchParams({ keyword })
      if (searchMarket) {
        params.set("market", searchMarket)
      }
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

      const parsed = parseSearchInput(
        inputValue,
        knownMarkets,
        isSpecificMarket ? market : "",
      )

      if (!parsed.validMarket || parsed.keyword.length < 2) {
        callback([])
        return
      }

      debounceRef.current = setTimeout(async () => {
        try {
          const results = await doFetch(parsed.keyword, parsed.market)
          let options = results.map((r) => toOption(r))
          if (filterResults) {
            options = filterResults(options)
          }
          callback(options)
        } catch {
          callback([])
        }
      }, 300)
    },
    [market, knownMarkets, isSpecificMarket, doFetch, filterResults],
  )

  const handleChange = useCallback(
    (selected: AssetOption | null): void => {
      setInputText("")
      lastSelectedRef.current = selected
      if (!isControlled) setInternalValue(selected)
      onSelect(selected)
    },
    [onSelect, isControlled],
  )

  const handleInputChange = useCallback(
    (newValue: string, meta: { action: string }): void => {
      if (meta.action === "input-change") {
        setInputText(newValue.toUpperCase())
      }
    },
    [],
  )

  const noOptionsMessage = useCallback(
    ({ inputValue }: { inputValue: string }): React.ReactNode => {
      if (knownMarkets) {
        const parsed = parseSearchInput(inputValue, knownMarkets)
        if (!parsed.validMarket) {
          return `Market "${parsed.market}" is not supported`
        }
      }
      if (inputValue.length < 2) {
        return "Type at least 2 characters"
      }
      if (noResultsHref) {
        return (
          <span>
            No results found.{" "}
            <a href={noResultsHref} className="text-blue-600 hover:underline">
              Create a private asset?
            </a>
          </span>
        )
      }
      return "No assets found"
    },
    [knownMarkets, noResultsHref],
  )

  const sharedProps = {
    inputId,
    placeholder: placeholder || "Search for asset...",
    noOptionsMessage,
    loadingMessage: () => "Searching...",
    onChange: handleChange,
    isClearable,
    inputValue: inputText,
    onInputChange: handleInputChange,
    menuPortalTarget:
      usePortal && typeof document !== "undefined" ? document.body : null,
    menuPosition: (usePortal ? "fixed" : "absolute") as "fixed" | "absolute",
    menuPlacement: "bottom" as const,
    menuShouldScrollIntoView: false,
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
            {...sharedProps}
            cacheOptions={false}
            loadOptions={loadOptions}
            {...field}
            onChange={(selected: AssetOption | null) => {
              handleChange(selected)
              field.onChange(selected?.symbol || selected?.value || "")
            }}
            value={
              field.value
                ? lastSelectedRef.current?.symbol === field.value
                  ? lastSelectedRef.current
                  : {
                      value: field.value,
                      label: stripOwnerPrefix(field.value),
                      symbol: field.value,
                    }
                : defaultValue
                  ? {
                      value: defaultValue,
                      label: stripOwnerPrefix(defaultValue),
                      symbol: defaultValue,
                    }
                  : null
            }
          />
        )}
      />
    )
  }

  // Standalone mode: async search
  return (
    <AsyncSelect<AssetOption>
      {...sharedProps}
      cacheOptions={false}
      loadOptions={loadOptions}
      value={displayValue}
    />
  )
}
