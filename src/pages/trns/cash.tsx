import React, { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { CurrencyOption, Portfolio } from "types/beancounter"
import { calculateTradeAmount } from "@lib/trns/tradeUtils"
import { useTranslation } from "next-i18next"
import useSwr from "swr"
import { ccyKey, simpleFetcher } from "@lib/api/fetchHelper"
import { rootLoader } from "@components/ui/PageLoader"
import { CurrencyOptionSchema } from "@lib/portfolio/schema"
import { onSubmit, useEscapeHandler } from "@lib/trns/formUtils"
import TradeTypeController from "@components/features/transactions/TradeTypeController"
import { currencyOptions } from "@lib/currency"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"

const TradeTypeValues = ["DEPOSIT", "WITHDRAWAL", "FX"] as const

const defaultValues = {
  type: { value: "DEPOSIT", label: "DEPOSIT" },
  asset: "USD",
  market: "CASH",
  tradeDate: new Date().toISOString().split("T")[0],
  tradeCurrency: { value: "USD", label: "USD" },
  cashCurrency: { value: "USD", label: "USD" },
  quantity: 0,
  price: 1,
  tradeAmount: 0,
  cashAmount: 0,
  fees: 0,
  tax: 0,
  comment: "",
}

const cashSchema = yup.object().shape({
  type: yup
    .object()
    .shape({
      value: yup.string().required().default(defaultValues.type.value),
      label: yup.string().required().default(defaultValues.type.label),
    })
    .required(),
  asset: yup.string().required(),
  market: yup.string().notRequired(),
  tradeDate: yup.string().required(),
  tradeAmount: yup.number(),
  quantity: yup.number().required().default(defaultValues.quantity),
  tradeCurrency: CurrencyOptionSchema.required(),
  cashCurrency: CurrencyOptionSchema.required(),
  cashAmount: yup.number(),
  fees: yup.number().required().default(defaultValues.fees),
  tax: yup.number().required().default(defaultValues.tax),
  comment: yup.string().notRequired(),
})

const CashInputForm: React.FC<{
  portfolio: Portfolio
  modalOpen: boolean
  setModalOpen: (open: boolean) => void
}> = ({ portfolio, modalOpen, setModalOpen }) => {
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm({
    resolver: yupResolver(cashSchema),
    defaultValues,
  })
  const { data: ccyData, isLoading } = useSwr(ccyKey, simpleFetcher(ccyKey))
  const { t } = useTranslation("common")

  const tax = watch("tax")
  const fees = watch("fees")
  const type = watch("type")
  const qty = watch("quantity")

  useEscapeHandler(isDirty, setModalOpen)

  useEffect(() => {
    const asset = watch("asset")
    if (asset) {
      setValue("tradeCurrency", { value: asset, label: asset })
      setValue("cashCurrency", { value: asset, label: asset })
    }
  }, [watch, setValue])
  useEffect(() => {
    const tradeAmount = calculateTradeAmount(qty, 1, tax, fees, type.value)
    setValue("tradeAmount", parseFloat(tradeAmount.toFixed(2)))
    setValue("cashAmount", parseFloat(tradeAmount.toFixed(2)))
  }, [tax, fees, type, qty, setValue])

  if (isLoading) return rootLoader(t("loading"))

  const ccyOptions = currencyOptions(ccyData.data)

  return (
    <>
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black opacity-50"
            onClick={() => setModalOpen(false)}
          ></div>
          <div
            className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-auto p-6 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex justify-between items-center border-b pb-2 mb-4">
              <h2 className="text-xl font-semibold">{t("trade.cash.title")}</h2>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setModalOpen(false)}
              >
                &times;
              </button>
            </header>
            <form
              onSubmit={handleSubmit((data) =>
                onSubmit(portfolio, errors, data, setModalOpen),
              )}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    name: "type",
                    label: t("trn.type"),
                    component: (
                      <TradeTypeController
                        name="type"
                        control={control}
                        options={TradeTypeValues.map((value) => ({
                          value,
                          label: value,
                        }))}
                      />
                    ),
                  },
                  {
                    name: "tradeDate",
                    label: t("trn.tradeDate"),
                    component: (
                      <Controller
                        name="tradeDate"
                        control={control}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="date"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                          />
                        )}
                      />
                    ),
                  },
                  {
                    name: "asset",
                    label: t("trade.cash.asset"),
                    component: (
                      <Controller
                        name="asset"
                        control={control}
                        defaultValue={portfolio.currency.code}
                        render={({ field }) => (
                          <select
                            {...field}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                            value={field.value}
                          >
                            {ccyOptions.map((option: CurrencyOption) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        )}
                      />
                    ),
                  },

                  {
                    name: "quantity",
                    label: t("trn.amount.trade"),
                    component: (
                      <Controller
                        name="quantity"
                        control={control}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="number"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                          />
                        )}
                      />
                    ),
                  },
                  {
                    name: "fees",
                    label: t("trn.amount.charges"),
                    component: (
                      <Controller
                        name="fees"
                        control={control}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="number"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                          />
                        )}
                      />
                    ),
                  },
                  {
                    name: "tax",
                    label: t("trn.amount.tax"),
                    component: (
                      <Controller
                        name="tax"
                        control={control}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="number"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                          />
                        )}
                      />
                    ),
                  },
                  {
                    name: "comment",
                    label: t("trn.comments"),
                    component: (
                      <Controller
                        name="comment"
                        control={control}
                        render={({ field }) => (
                          <input
                            {...field}
                            type="text"
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height"
                            value={field.value || ""}
                          />
                        )}
                      />
                    ),
                  },
                ].map(({ name, label, component }) => (
                  <div key={name}>
                    <label className="block text-sm font-medium text-gray-700">
                      {label}
                    </label>
                    {errors[name as keyof typeof errors] && (
                      <p className="text-red-500 text-xs">
                        {errors[name as keyof typeof errors]?.message}
                      </p>
                    )}
                    {component}
                  </div>
                ))}
              </div>
              <div className="text-red-500 text-xs">
                {Object.values(errors)
                  .map((error) => error?.message)
                  .join(" ")}
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="submit"
                  className="bg-blue-500 text-white px-4 py-2 rounded"
                >
                  Submit
                </button>
                <button
                  type="button"
                  className="bg-gray-300 text-gray-700 px-4 py-2 rounded"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default CashInputForm

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale ?? "en", ["common"])),
  },
})
