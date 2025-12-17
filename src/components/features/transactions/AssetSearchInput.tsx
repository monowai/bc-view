import React, { useCallback, useRef } from "react"
import { Controller, Control } from "react-hook-form"
import AsyncSelect from "react-select/async"
import { useTranslation } from "next-i18next"
import { AssetSearchResult } from "types/beancounter"

export interface AssetOption {
  value: string
  label: string
  market?: string
  assetId?: string
  currency?: string
}

interface AssetSearchInputProps {
  name: string
  control: Control<any>
  market: string
  onAssetSelect?: (option: AssetOption | null) => void
  defaultValue?: string
}

/**
 * Async autocomplete component for searching assets.
 * Searches private assets or public assets via AlphaVantage based on selected market.
 */
export default function AssetSearchInput({
  name,
  control,
  market,
  onAssetSelect,
  defaultValue,
}: AssetSearchInputProps): React.ReactElement {
  const { t } = useTranslation("common")
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const loadOptions = useCallback(
    (inputValue: string, callback: (options: AssetOption[]) => void): void => {
      // Clear any existing debounce timer
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      // Require at least 2 characters
      if (inputValue.length < 2) {
        callback([])
        return
      }

      // Debounce the search
      debounceRef.current = setTimeout(async () => {
        try {
          const params = new URLSearchParams({ keyword: inputValue })
          if (market) {
            params.append("market", market)
          }

          const response = await fetch(`/api/assets/search?${params}`)
          if (!response.ok) {
            callback([])
            return
          }

          const data = await response.json()
          const options: AssetOption[] = (data.data || []).map(
            (result: AssetSearchResult) => ({
              value: result.symbol,
              label: `${result.symbol} - ${result.name}`,
              market: result.market || market,
              assetId: result.assetId,
              currency: result.currency,
            }),
          )
          callback(options)
        } catch {
          callback([])
        }
      }, 300)
    },
    [market],
  )

  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <AsyncSelect
          {...field}
          cacheOptions
          loadOptions={loadOptions}
          placeholder={t("trn.asset.search.placeholder")}
          noOptionsMessage={({ inputValue }) =>
            inputValue.length < 2
              ? t("trn.asset.search.minChars")
              : t("trn.asset.search.noResults")
          }
          loadingMessage={() => t("trn.asset.search.loading")}
          onChange={(selected: AssetOption | null) => {
            field.onChange(selected?.value || "")
            onAssetSelect?.(selected)
          }}
          value={
            field.value
              ? { value: field.value, label: field.value }
              : defaultValue
                ? { value: defaultValue, label: defaultValue }
                : null
          }
          isClearable
          styles={{
            control: (base) => ({
              ...base,
              minHeight: "38px",
            }),
          }}
        />
      )}
    />
  )
}
