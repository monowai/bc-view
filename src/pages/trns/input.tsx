import React, { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import { Portfolio } from "@components/types/beancounter"
import { useTranslation } from "next-i18next"
import useSwr from "swr"
import { ccyKey, simpleFetcher } from "@utils/api/fetchHelper"
import {
  currencyOptions,
  toCurrency,
  toCurrencyOption,
} from "@components/currency"
import ReactSelect from "react-select"
import { rootLoader } from "@components/PageLoader"
import { CurrencyOptionSchema } from "@utils/portfolio/schema"
import { postData } from "@components/DropZone"
import TradeTypeController from "@components/TradeTypeController"

interface TrnInputFormProps {
  portfolio: Portfolio
  isOpen: boolean
  closeModal: () => void
}

const TrnTypeValues = ["BUY", "SELL", "DIVI", "SPLIT"] as const

const defaultValues = {
  type: { value: "BUY", label: "BUY" },
  asset: "",
  market: "US",
  tradeDate: new Date().toISOString().split("T")[0],
  quantity: 0,
  price: 0,
  tradeCurrency: { value: "USD", label: "USD" },
  tradeAmount: 0,
  fees: 0,
  tax: 0,
}

const schema = yup.object().shape({
  type: yup
    .object()
    .shape({
      value: yup.string().required().default(defaultValues.type.value),
      label: yup.string().required().default(defaultValues.type.value),
    })
    .required(),
  asset: yup.string().required(),
  market: yup.string().required(),
  tradeDate: yup.string().required(),
  quantity: yup.number().default(0).required(),
  price: yup.number().required().default(0),
  tradeAmount: yup.number(),
  tradeCurrency: CurrencyOptionSchema.required(),
  cashAmount: yup.number(),
  tradeCashRate: yup.number(),
  fees: yup.number().required().default(defaultValues.fees),
  tax: yup.number().required().default(defaultValues.tax),
  tradeBaseRate: yup.number(),
  tradePortfolioRate: yup.number(),
  cashCurrency: yup.string(),
})

const TrnInputForm: React.FC<TrnInputFormProps> = ({ portfolio }) => {
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: {
      type: defaultValues.type,
      tradeDate: defaultValues.tradeDate,
      asset: defaultValues.asset,
      market: defaultValues.market,
      tradeAmount: defaultValues.tradeAmount,
      price: defaultValues.price,
      quantity: defaultValues.quantity,
      fees: defaultValues.fees,
      tax: defaultValues.tax,
    },
  })
  const ccyResponse = useSwr(ccyKey, simpleFetcher(ccyKey))
  const options = TrnTypeValues.map((value) => ({ value, label: value }))
  const { t } = useTranslation("common")
  const [modalIsOpen, setModalIsOpen] = useState(false)

  const quantity = watch("quantity")
  const price = watch("price")
  const tax = watch("tax")
  const fees = watch("fees")
  const type = watch("type")

  useEffect(() => {
    if (quantity && price) {
      const qty = Number(quantity)
      const prc = Number(price)
      const tx = Number(tax)
      const fee = Number(fees)
      const tradeAmount =
        type.value === "SELL" ? qty * prc - tx - fee : qty * prc + fee + tx
      setValue("tradeAmount", parseFloat(tradeAmount.toFixed(2)))
    }
  }, [quantity, price, tax, fees, type, setValue])

  const onSubmit = (data: any): void => {
    console.log("Form submitted with data:", data)
    data.cashCurrency = data.tradeCurrency
    const date = new Date()
    const formattedDate = `${date.getFullYear()}${("0" + (date.getMonth() + 1)).slice(-2)}${("0" + date.getDate()).slice(-2)}`
    const row = `${formattedDate},,${data.type.value},${data.market},${data.asset},,,${data.cashCurrency.value},${data.tradeDate},${data.quantity},,${data.tradeCurrency.value},${data.price},${data.fees},,,,`
    alert(row)
    postData(portfolio, false, row.split(",")).then((r) => console.log(r))
    setModalIsOpen(false)
  }

  if (ccyResponse.isLoading) return rootLoader(t("loading"))

  const ccyOptions = currencyOptions(ccyResponse.data.data)
  const currencies = ccyResponse.data.data
  let errorString = ""
  Object.values(errors).forEach((error) => {
    if (error?.message) errorString += error.message + " "
  })

  return (
    <div>
      <button
        className="navbar-item button is-link is-small"
        onClick={() => setModalIsOpen(true)}
      >
        {t("trn.add")}
      </button>

      <div className={`modal ${modalIsOpen ? "is-active" : ""}`}>
        <div
          className="modal-background"
          onClick={() => setModalIsOpen(false)}
        ></div>
        <div className="modal-card">
          <header className="modal-card-head">
            <p className="modal-card-title">Add Transaction</p>
            <button
              className="delete"
              aria-label="close"
              onClick={() => setModalIsOpen(false)}
            ></button>
          </header>
          <section className="modal-card-body">
            <form onSubmit={handleSubmit(onSubmit)} className="form">
              <div className="form-columns">
                <div className="form-column">
                  <div className="form-group">
                    <label>{t("trn.type")}</label>
                    <TradeTypeController
                      name="type"
                      control={control}
                      options={options}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("trn.tradeDate")}</label>
                    {errors.tradeDate && (
                      <p className="error">{errors.tradeDate.message}</p>
                    )}
                    <Controller
                      name="tradeDate"
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="date"
                          className="input"
                          tabIndex={2}
                        />
                      )}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("trn.asset.code")}</label>
                    {errors.asset && (
                      <p className="error">{errors.asset.message}</p>
                    )}
                    <Controller
                      name="asset"
                      control={control}
                      defaultValue={defaultValues.asset}
                      render={({ field }) => (
                        <input
                          {...field}
                          className="input"
                          onFocus={(event) => event.target.select()}
                          onChange={(event) => {
                            event.target.value =
                              event.target.value.toUpperCase()
                            field.onChange(event)
                          }}
                          tabIndex={3}
                        />
                      )}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("trn.market.code")}</label>
                    {errors.market && (
                      <p className="error">{errors.market.message}</p>
                    )}
                    <Controller
                      name="market"
                      control={control}
                      defaultValue={defaultValues.market}
                      render={({ field }) => (
                        <input
                          {...field}
                          onFocus={(event) => event.target.select()}
                          onChange={(event) => {
                            event.target.value =
                              event.target.value.toUpperCase()
                            field.onChange(event)
                          }}
                          className="input"
                          tabIndex={4}
                        />
                      )}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("trn.currency")}</label>
                    <Controller
                      name="tradeCurrency"
                      control={control}
                      defaultValue={toCurrencyOption(portfolio.currency)}
                      rules={{ required: true }}
                      render={({ field }) => (
                        <ReactSelect
                          {...field}
                          defaultValue={toCurrencyOption(portfolio.currency)}
                          options={ccyOptions}
                          onChange={(event) => {
                            field.onChange(
                              toCurrency(event!!.value, currencies),
                            )
                          }}
                          tabIndex={5}
                        />
                      )}
                    />
                  </div>
                </div>
                <div className="form-column">
                  <div className="form-group">
                    <label>{t("quantity")}</label>
                    <Controller
                      name="quantity"
                      defaultValue={defaultValues.quantity}
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="number"
                          className="input"
                          onFocus={(event) => event.target.select()}
                          tabIndex={6}
                        />
                      )}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("trn.price")}</label>
                    <Controller
                      name="price"
                      control={control}
                      defaultValue={defaultValues.price}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="number"
                          className="input"
                          onFocus={(event) => event.target.select()}
                          tabIndex={7}
                        />
                      )}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("trn.amount.charges")}</label>
                    <Controller
                      name="fees"
                      defaultValue={defaultValues.fees}
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="number"
                          className="input"
                          onFocus={(event) => event.target.select()}
                          tabIndex={8}
                        />
                      )}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("trn.amount.tax")}</label>
                    <Controller
                      name="tax"
                      defaultValue={defaultValues.tax}
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="number"
                          className="input"
                          onFocus={(event) => event.target.select()}
                          tabIndex={9}
                        />
                      )}
                    />
                  </div>
                  <div className="form-group">
                    <label>{t("trn.amount.trade")}</label>
                    <Controller
                      name="tradeAmount"
                      defaultValue={defaultValues.tradeAmount}
                      control={control}
                      render={({ field }) => (
                        <input
                          {...field}
                          type="number"
                          className="input"
                          onFocus={(event) => event.target.select()}
                          tabIndex={10}
                        />
                      )}
                    />
                  </div>
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="button is-link" tabIndex={11}>
                  Submit
                </button>
                <button
                  type="button"
                  className="button is-link is-light"
                  onClick={() => setModalIsOpen(false)}
                  tabIndex={12}
                >
                  Cancel
                </button>
              </div>
              <div>{errorString}</div>
            </form>
          </section>
        </div>
      </div>
    </div>
  )
}

export default TrnInputForm
