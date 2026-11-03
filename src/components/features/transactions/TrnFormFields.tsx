import React from "react"
import {
  Control,
  Controller,
  ControllerProps,
  FieldPath,
  FieldValues,
} from "react-hook-form"
import DateInput from "@components/ui/DateInput"
import MathInput from "@components/ui/MathInput"

interface TrnFieldProps<T extends FieldValues> {
  // The third generic is the resolver's output type, which these fields ignore.
  control: Control<T, any, any>
  name: FieldPath<T>
  label: React.ReactNode
  labelClassName: string
  inputClassName: string
}

function TrnField<T extends FieldValues>({
  control,
  name,
  label,
  labelClassName,
  render,
  children,
}: Omit<TrnFieldProps<T>, "inputClassName"> & {
  render: ControllerProps<T, FieldPath<T>, any>["render"]
  children?: React.ReactNode
}): React.ReactElement {
  return (
    <div>
      <label className={labelClassName}>{label}</label>
      <Controller name={name} control={control} render={render} />
      {children}
    </div>
  )
}

export function TrnDateField<T extends FieldValues>({
  inputClassName,
  ...field
}: TrnFieldProps<T>): React.ReactElement {
  return (
    <TrnField
      {...field}
      render={({ field: { value, onChange } }) => (
        <DateInput
          value={value}
          onChange={onChange}
          className={inputClassName}
        />
      )}
    />
  )
}

export function TrnMathField<T extends FieldValues>({
  inputClassName,
  onChange,
  error,
  ...field
}: TrnFieldProps<T> & {
  /** Replaces the form update; call `applyChange` to still write the field. */
  onChange?: (value: number, applyChange: (value: number) => void) => void
  error?: string
}): React.ReactElement {
  return (
    <TrnField
      {...field}
      render={({ field: { value, onChange: applyChange } }) => (
        <MathInput
          value={value}
          onChange={
            onChange ? (next) => onChange(next, applyChange) : applyChange
          }
          className={inputClassName}
        />
      )}
    >
      {error && <p className="text-red-500 text-xs">{error}</p>}
    </TrnField>
  )
}

export function TrnTextField<T extends FieldValues>({
  inputClassName,
  placeholder,
  ...field
}: TrnFieldProps<T> & { placeholder?: string }): React.ReactElement {
  return (
    <TrnField
      {...field}
      render={({ field: controlled }) => (
        <input
          {...controlled}
          type="text"
          className={inputClassName}
          value={controlled.value || ""}
          placeholder={placeholder}
        />
      )}
    />
  )
}
