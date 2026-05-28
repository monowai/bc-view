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
  /**
   * Options to show immediately when the dropdown opens (before the user
   * types). Used by the header search to surface recent picks on focus.
   */
  defaultOptions?: AssetOption[] | boolean
  /**
   * Whether AsyncSelect should cache loaded options by input value.
   * Default false to keep behaviour aligned with the previous implementation.
   */
  cacheOptions?: boolean
  /**
   * Options surfaced when the user's keyword is too short for a server
   * search (< 2 chars). Use for recent-search lists so the dropdown
   * never feels empty.
   */
  fallbackOptions?: AssetOption[]
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
  defaultOptions,
  cacheOptions = false,
  fallbackOptions,
}: AssetSearchProps): React.ReactElement {
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const [inputText, setInputText] = useState("")
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = useState<AssetOption | null>(null)
  const lastSelectedRef = useRef<AssetOption | null>(null)
  const displayValue = isControlled ? value : internalValue
  // Explicit search-in-flight flag. AsyncSelect only flips its internal
  // isLoading while the loadOptions promise is pending, so the 300ms debounce
  // + backend round-trip (up to ~3s with the per-provider coroutine cap)
  // would otherwise show no spinner. Drive isLoading from this so the user
  // sees feedback the moment they type.
  const [isSearching, setIsSearching] = useState(false)

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
        setIsSearching(false)
        callback(
          fallbackOptions && fallbackOptions.length > 0 ? fallbackOptions : [],
        )
        return
      }

      setIsSearching(true)
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
        } finally {
          setIsSearching(false)
        }
      }, 300)
    },
    [
      market,
      knownMarkets,
      isSpecificMarket,
      doFetch,
      filterResults,
      fallbackOptions,
    ],
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
    // Drive the spinner from our own flag so it shows from the first keystroke
    // through the debounce window, not just while the fetch promise is alive.
    isLoading: isSearching,
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
      menu: (base: Record<string, unknown>) => ({
        ...base,
        backgroundColor: "#ffffff",
        color: "#111827",
      }),
      menuList: (base: Record<string, unknown>) => ({
        ...base,
        backgroundColor: "#ffffff",
      }),
      menuPortal: (base: Record<string, unknown>) => ({
        ...base,
        zIndex: 9999,
      }),
      option: (
        base: Record<string, unknown>,
        state: { isFocused: boolean; isSelected: boolean },
      ) => ({
        ...base,
        backgroundColor: state.isSelected
          ? "#2563eb"
          : state.isFocused
            ? "#dbeafe"
            : "#ffffff",
        color: state.isSelected ? "#ffffff" : "#111827",
        cursor: "pointer",
        borderLeft: state.isFocused
          ? "3px solid #2563eb"
          : "3px solid transparent",
      }),
      singleValue: (base: Record<string, unknown>) => ({
        ...base,
        color: "#111827",
      }),
      input: (base: Record<string, unknown>) => ({
        ...base,
        color: "#111827",
      }),
      placeholder: (base: Record<string, unknown>) => ({
        ...base,
        color: "#6b7280",
      }),
      noOptionsMessage: (base: Record<string, unknown>) => ({
        ...base,
        color: "#6b7280",
      }),
      loadingMessage: (base: Record<string, unknown>) => ({
        ...base,
        color: "#6b7280",
      }),
      loadingIndicator: (base: Record<string, unknown>) => ({
        ...base,
        // Default DotLoader uses currentColor which inherits the muted control
        // text — invisible against the white input. Brand-blue makes it stand
        // out so users know a search is in flight.
        color: "#2563eb",
        fontSize: "8px",
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
            cacheOptions={cacheOptions}
            defaultOptions={defaultOptions}
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
