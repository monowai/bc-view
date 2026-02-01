import React, { useCallback, useRef, useState } from "react"
import { Controller, Control } from "react-hook-form"
import Select from "react-select"
import AsyncSelect from "react-select/async"
import { useTranslation } from "next-i18next"
import { AssetOption, AssetSearchResult } from "types/beancounter"
import { stripOwnerPrefix } from "@lib/assets/assetUtils"
import { parseSearchInput } from "./parseSearchInput"

const EXPAND_SENTINEL = "__expand_search__"
const NO_RESULTS_SENTINEL = "__no_results__"

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
 * Unified asset search component wrapping react-select/async.
 *
 * Search behaviour:
 * - Specific market (market prop is set and not "LOCAL"): search that market directly.
 * - LOCAL / unset: search LOCAL first, show "Expand Search?" sentinel.
 * - "Expand Search?" fetches FIGI, merges results, shows via base Select.
 * - If no results after expand, shows "No results" with optional create-asset link.
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
}: AssetSearchProps): React.ReactElement {
  const { t } = useTranslation("common")
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [inputText, setInputText] = useState("")
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = useState<AssetOption | null>(null)
  const displayValue = isControlled ? value : internalValue
  const lastKeywordRef = useRef("")
  const localResultsRef = useRef<AssetOption[]>([])
  // When set, renders a base Select with these options instead of AsyncSelect
  const [expandedOptions, setExpandedOptions] = useState<AssetOption[] | null>(
    null,
  )
  const expandingRef = useRef(false)

  const isSpecificMarket =
    market !== undefined && market !== ""

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

      // Parse MARKET:KEYWORD syntax. Backend handles LOCAL+external merge.
      const parsed = parseSearchInput(
        inputValue,
        knownMarkets,
        isSpecificMarket ? market : "",
      )

      if (!parsed.validMarket || parsed.keyword.length < 2) {
        callback([])
        return
      }

      lastKeywordRef.current = parsed.keyword

      debounceRef.current = setTimeout(async () => {
        try {
          // Pass market directly — backend searches local DB + external provider
          const results = await doFetch(parsed.keyword, parsed.market)
          let options = results.map((r) => toOption(r))

          if (filterResults) {
            options = filterResults(options)
          }

          const expandOption: AssetOption = {
            value: EXPAND_SENTINEL,
            label: t("trn.asset.search.expandSearch", "Expand Search?"),
            symbol: "",
          }

          localResultsRef.current = options
          // Always offer expand to force FIGI global search
          callback([...options, expandOption])
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

    expandingRef.current = true
    try {
      const figiResults = await doFetch(keyword, "FIGI")
      let figiOptions = figiResults.map((r) => toOption(r))
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

      if (merged.length === 0) {
        setExpandedOptions([
          {
            value: NO_RESULTS_SENTINEL,
            label: t("trn.asset.search.noResults", "No assets found"),
            symbol: "",
          },
        ])
      } else {
        setExpandedOptions(merged)
      }
      setMenuOpen(true)
    } catch {
      // On error, keep existing results
    } finally {
      expandingRef.current = false
    }
  }, [doFetch, filterResults, t])

  const handleChange = useCallback(
    (selected: AssetOption | null): void => {
      if (selected?.value === EXPAND_SENTINEL) {
        handleExpandSearch()
        return
      }
      if (selected?.value === NO_RESULTS_SENTINEL) {
        if (noResultsHref) {
          window.location.href = noResultsHref
        }
        return
      }
      setMenuOpen(false)
      setInputText("")
      setExpandedOptions(null)
      if (!isControlled) setInternalValue(selected)
      onSelect(selected)
    },
    [onSelect, handleExpandSearch, noResultsHref, isControlled],
  )

  const handleInputChange = useCallback(
    (newValue: string, meta: { action: string }): void => {
      if (meta.action === "input-change") {
        setInputText(newValue)
        // Clear expanded results when user starts typing again
        if (expandedOptions) {
          setExpandedOptions(null)
        }
      }
    },
    [expandedOptions],
  )

  const handleMenuOpen = useCallback((): void => {
    setMenuOpen(true)
  }, [])

  const handleMenuClose = useCallback((): void => {
    if (!expandingRef.current) {
      setMenuOpen(false)
    }
  }, [])

  const formatOptionLabel = useCallback(
    (option: AssetOption): React.ReactNode => {
      if (option.value === EXPAND_SENTINEL) {
        return (
          <div className="text-center text-blue-600 font-medium text-sm">
            <span>
              <i className="fas fa-search-plus mr-1"></i>
              {t("trn.asset.search.expandSearch", "Expand Search?")}
            </span>
          </div>
        )
      }
      if (option.value === NO_RESULTS_SENTINEL) {
        return (
          <div className="text-center text-sm">
            <div className="text-gray-500">
              {t("trn.asset.search.noResults", "No assets found")}
            </div>
            {noResultsHref && (
              <div className="text-blue-600 mt-1">
                <i className="fas fa-plus-circle mr-1"></i>
                {t(
                  "trn.asset.search.createAsset",
                  "Create a private asset",
                )}
              </div>
            )}
          </div>
        )
      }
      return option.label
    },
    [noResultsHref, t],
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

  const sharedProps = {
    placeholder: placeholder || t("trn.asset.search.placeholder"),
    noOptionsMessage,
    loadingMessage: () => t("trn.asset.search.loading", "Searching..."),
    onChange: handleChange,
    isClearable,
    formatOptionLabel,
    inputValue: inputText,
    onInputChange: handleInputChange,
    menuIsOpen: menuOpen,
    onMenuOpen: handleMenuOpen,
    onMenuClose: handleMenuClose,
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
            {...sharedProps}
            cacheOptions={false}
            loadOptions={loadOptions}
            {...field}
            onChange={(selected: AssetOption | null) => {
              handleChange(selected)
              if (
                selected?.value !== EXPAND_SENTINEL &&
                selected?.value !== NO_RESULTS_SENTINEL
              ) {
                field.onChange(selected?.value || "")
              }
            }}
            value={
              field.value
                ? { value: field.value, label: stripOwnerPrefix(field.value), symbol: field.value }
                : defaultValue
                  ? { value: defaultValue, label: stripOwnerPrefix(defaultValue), symbol: defaultValue }
                  : null
            }
          />
        )}
      />
    )
  }

  // After expand: render base Select with static options (no portal needed)
  if (expandedOptions) {
    return (
      <Select<AssetOption>
        {...sharedProps}
        options={expandedOptions}
        value={displayValue}
        filterOption={null}
        menuPortalTarget={null}
        menuPosition={"absolute" as const}
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
