import React, { useId, useMemo, useState } from "react"
import Select from "react-select"
import { Currency } from "types/beancounter"

export interface CurrencySelectProps {
  label: string
  value: string
  currencies: Currency[]
  onChange: (code: string) => void
}

export default function CurrencySelect({
  label,
  value,
  currencies,
  onChange,
}: CurrencySelectProps): React.ReactElement {
  const [menuOpen, setMenuOpen] = useState(false)
  const inputId = useId()

  const options = useMemo(
    () =>
      currencies.map((c) => ({
        value: c.code,
        label: `${c.code} - ${c.name}`,
      })),
    [currencies],
  )

  return (
    <>
      <label
        htmlFor={inputId}
        className="mb-1 block text-xs font-medium text-slate-500"
      >
        {label}
      </label>
      <Select
        inputId={inputId}
        options={options}
        value={options.find((o) => o.value === value) ?? null}
        onChange={(selected) => {
          if (selected) onChange(selected.value)
        }}
        onMenuOpen={() => setMenuOpen(true)}
        onMenuClose={() => setMenuOpen(false)}
        onKeyDown={(e) => {
          // Escape closes the open list, not the calculator behind it.
          if (e.key === "Escape" && menuOpen) e.stopPropagation()
        }}
        menuPortalTarget={
          typeof document !== "undefined" ? document.body : null
        }
        menuPosition="fixed"
        styles={{
          control: (base) => ({ ...base, fontSize: "0.875rem" }),
          menu: (base) => ({ ...base, fontSize: "0.875rem" }),
          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        }}
      />
    </>
  )
}
