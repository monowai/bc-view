import React, {useEffect, useState} from "react"
import {Controller, useForm} from "react-hook-form"
import {yupResolver} from "@hookform/resolvers/yup"
import * as yup from "yup"
import {Portfolio} from "types/beancounter"
import {calculateTradeAmount, getTradeRow} from "@utils/trns/tradeUtils"
import {useTranslation} from "next-i18next"
import useSwr from "swr"
import {ccyKey, simpleFetcher} from "@utils/api/fetchHelper"
import {currencyOptions, toCurrencyOption} from "@components/currency"
import ReactSelect from "react-select"
import {rootLoader} from "@components/PageLoader"
import {CurrencyOptionSchema} from "@utils/portfolio/schema"
import {postData} from "@components/DropZone"
import TradeTypeController from "@components/TradeTypeController"

interface TrnInputFormProps {
  portfolio: Portfolio
  isOpen: boolean
  closeModal: () => void
}

const TradeTypeValues = ["BUY", "SELL", "DIVI", "SPLIT"] as const

const defaultValues = {
  type: {value: "BUY", label: "BUY"},
  asset: "",
  market: "US",
  tradeDate: new Date().toISOString().split("T")[0],
  quantity: 0,
  price: 0,
  tradeCurrency: {value: "USD", label: "USD"},
  cashCurrency: {value: "USD", label: "USD"},
  tradeAmount: 0,
  cashAmount: 0,
  fees: 0,
  tax: 0,
  comment: "",
}

const schema = yup.object().shape({
  type: yup
    .object()
    .shape({
      value: yup.string().required().default(defaultValues.type.value),
      label: yup.string().required().default(defaultValues.type.label),
    })
    .required(),
  asset: yup.string().required(),
  market: yup.string().required(),
  tradeDate: yup.string().required(),
  quantity: yup.number().default(0).required(),
  price: yup.number().required().default(0),
  tradeAmount: yup.number(),
  // tradeCurrency: CurrencyOptionSchema.required(),
  cashCurrency: CurrencyOptionSchema.required(),
  cashAmount: yup.number(),
  tradeCashRate: yup.number(),
  fees: yup.number().required().default(defaultValues.fees),
  tax: yup.number().required().default(defaultValues.tax),
  tradeBaseRate: yup.number(),
  tradePortfolioRate: yup.number(),
  comment: yup.string().notRequired()
})

const TradeInputForm: React.FC<TrnInputFormProps> = ({portfolio}) => {
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: {errors},
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      type: defaultValues.type,
      tradeDate: defaultValues.tradeDate,
      asset: defaultValues.asset,
      market: defaultValues.market,
      tradeAmount: defaultValues.tradeAmount,
      cashAmount: defaultValues.cashAmount,
      price: defaultValues.price,
      quantity: defaultValues.quantity,
      fees: defaultValues.fees,
      tax: defaultValues.tax,
      cashCurrency: {value: "USD", label: "USD"},
      comment: defaultValues.comment,
    },
  })
  const ccyResponse = useSwr(ccyKey, simpleFetcher(ccyKey))
  const options = TradeTypeValues.map((value) => ({value, label: value}))
  const {t} = useTranslation("common")
  const [tradeModalOpen, setTradeModalOpen] = useState(false)

  const quantity = watch("quantity")
  const price = watch("price")
  const tax = watch("tax")
  const fees = watch("fees")
  const type = watch("type")
  const cashCurrency = watch("cashCurrency")

  useEffect(() => {
    if (quantity && price) {
      const tradeAmount = calculateTradeAmount(
        quantity,
        price,
        tax,
        fees,
        type.value
      )
      setValue("tradeAmount", parseFloat(tradeAmount.toFixed(2)))
      //setValue("cashAmount", calculateCashAmount(tradeAmount, cashCurrency, type.value))
    }
  }, [quantity, price, tax, fees, type, setValue, cashCurrency])

  const onSubmit = (data: any): void => {
    if (Object.keys(errors).length > 0) {
      console.log("Validation errors:", errors);
      return;
    }
    const row = getTradeRow(data)
    console.log(row);
    // navigator.clipboard.writeText(row).then(() => {
    //   console.log("Row text copied to clipboard");
    // }).catch(err => {
    //   console.error("Failed to copy row text: ", err);
    // });
    alert (row)
    const userConfirmed = window.confirm(`Do you want to submit the transaction?`);
    if (userConfirmed) {
      postData(portfolio, false, row.split(",")).then((r) => console.log(r));
      setTradeModalOpen(false);
    } else {
      console.log("Transaction submission canceled");
    }
  }

  if (ccyResponse.isLoading) return rootLoader(t("loading"))

  const ccyOptions = currencyOptions(ccyResponse.data.data)
  let errorString = ""
  Object.values(errors).forEach((error) => {
    if (error?.message) errorString += error.message + " "
  })

  return (
    <div>
      <button
        className="bg-blue-500 text-white px-4 py-1 rounded"
        onClick={() => setTradeModalOpen(true)}
      >
        {t("trn.trade")}
      </button>

      {tradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black opacity-50"
            onClick={() => setTradeModalOpen(false)}
          ></div>
          <div
            className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-auto p-6 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex justify-between items-center border-b pb-2 mb-4">
              <h2 className="text-xl font-semibold">{t("trade.title")}</h2>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setTradeModalOpen(false)}
              >
                <span className="sr-only">Close</span>
                &times;
              </button>
            </header>
            <section>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {t("trn.type")}
                    </label>
                    <TradeTypeController
                      name="type"
                      control={control}
                      options={options}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {t("trn.tradeDate")}
                    </label>
                    {errors.tradeDate && (
                      <p className="text-red-500 text-xs">
                        {errors.tradeDate.message}
                      </p>
                    )}
                    <Controller
                      name="tradeDate"
                      control={control}
                      render={({field}) => (
                        <input
                          {...field}
                          type="date"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {t("trn.currency.cash")}
                    </label>
                    <Controller
                      name="cashCurrency"
                      control={control}
                      defaultValue={toCurrencyOption(portfolio.currency)}
                      rules={{required: true}}
                      render={({field}) => (
                        <ReactSelect
                          {...field}
                          options={ccyOptions}
                          className="mt-1"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {t("trn.amount.cash")}
                    </label>
                    <Controller
                      name="cashAmount"
                      defaultValue={defaultValues.tradeAmount}
                      control={control}
                      render={({field}) => (
                        <input
                          {...field}
                          type="number"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {t("trn.asset.code")}
                    </label>
                    {errors.asset && (
                      <p className="text-red-500 text-xs">
                        {errors.asset.message}
                      </p>
                    )}
                    <Controller
                      name="asset"
                      control={control}
                      defaultValue={defaultValues.asset}
                      render={({field}) => (
                        <input
                          {...field}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {t("trn.market.code")}
                    </label>
                    {errors.market && (
                      <p className="text-red-500 text-xs">
                        {errors.market.message}
                      </p>
                    )}
                    <Controller
                      name="market"
                      control={control}
                      defaultValue={defaultValues.market}
                      render={({field}) => (
                        <input
                          {...field}
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {t("quantity")}
                    </label>
                    <Controller
                      name="quantity"
                      defaultValue={defaultValues.quantity}
                      control={control}
                      render={({field}) => (
                        <input
                          {...field}
                          type="number"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {t("trn.price")}
                    </label>
                    <Controller
                      name="price"
                      control={control}
                      defaultValue={defaultValues.price}
                      render={({field}) => (
                        <input
                          {...field}
                          type="number"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {t("trn.amount.charges")}
                    </label>
                    <Controller
                      name="fees"
                      defaultValue={defaultValues.fees}
                      control={control}
                      render={({field}) => (
                        <input
                          {...field}
                          type="number"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {t("trn.amount.tax")}
                    </label>
                    <Controller
                      name="tax"
                      defaultValue={defaultValues.tax}
                      control={control}
                      render={({field}) => (
                        <input
                          {...field}
                          type="number"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {t("trn.amount.trade")}
                    </label>
                    <Controller
                      name="tradeAmount"
                      defaultValue={defaultValues.tradeAmount}
                      control={control}
                      render={({field}) => (
                        <input
                          {...field}
                          type="number"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                        />
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {t("trn.comments")}
                    </label>
                    <Controller
                      name="comment"
                      control={control}
                      defaultValue={defaultValues.comment}
                      render={({field}) => (
                        <input
                          {...field}
                          type="text"
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
                          value={field.value ?? ""}
                        />
                      )}
                    />
                  </div>
                </div>
                <div className="text-red-500 text-xs">{errorString}</div>
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
                    onClick={() => setTradeModalOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

export default TradeInputForm
