import React, { forwardRef } from "react"
import { Controller } from "react-hook-form"
import Select, { SelectInstance } from "react-select"

interface SelectControllerProps {
  name: string
  control: any
  options: { value: string; label: string }[]
}

const TradeTypeController = forwardRef<
  SelectInstance<{ value: string; label: string }>,
  SelectControllerProps
>(function TradeTypeController({ name, control, options }, ref) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <Select
          {...field}
          ref={ref}
          defaultValue={options[0]}
          options={options}
          menuPortalTarget={
            typeof document !== "undefined" ? document.body : null
          }
          menuPosition="fixed"
          styles={{
            menuPortal: (base) => ({
              ...base,
              zIndex: 9999,
            }),
          }}
        />
      )}
    />
  )
})

export default TradeTypeController
