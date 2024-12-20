import React, { useEffect, useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { yupResolver } from "@hookform/resolvers/yup"
import * as yup from "yup"
import Modal from "react-modal"
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
  type: {
    value: TrnTypeValues[0],
    label: TrnTypeValues[0],
  },
  tradeAmount: 0,
  price: 0,
  quantity: 0,
  tradeDate: new Date().toISOString().split("T")[0],
  asset: "",
  market: "US",
  fees: 0,
  tax: 0,
}

// Define validation schema with Yup
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
  tradeBaseRate: yup.number(),
  tradePortfolioRate: yup.number(),
  cashCurrency: yup.string(),
  cashAmount: yup.number(),
  tradeCashRate: yup.number(),
  fees: yup.number().required().default(defaultValues.fees),
  tax: yup.number().required().default(defaultValues.tax),
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
      setValue(
        "tradeAmount",
        parseFloat((quantity * price - tax - fees).toFixed(2)),
      )
    }
  }, [quantity, price, tax, fees, type, setValue])

  const onSubmit = (data: any): void => {
    console.log("Form submitted with data:", data)
    data.cashCurrency = data.tradeCurrency
    const date = new Date()
    const year = date.getFullYear()
    const month = ("0" + (date.getMonth() + 1)).slice(-2) // Months are 0-based in JavaScript
    const day = ("0" + date.getDate()).slice(-2)
    const formattedDate = `${year}${month}${day}`
    const row = `${formattedDate},,${data.type.value},${data.market},${data.asset},,,${data.cashCurrency.value},${data.tradeDate},${data.quantity},,${data.tradeCurrency.value},${data.price},${data.fees},,,,`
    alert(row)
    postData(portfolio, false, row.split(",")).then((r) => console.log(r))
    setModalIsOpen(false)
  }
  if (ccyResponse.isLoading) {
    return rootLoader(t("loading"))
  }
  const ccyOptions = currencyOptions(ccyResponse.data.data)
  const currencies = ccyResponse.data.data
  let errorString = ""
  Object.values(errors).forEach((error) => {
    if (error?.message) {
      errorString += error.message + " "
    }
  })
  return (
    <div>
      <button
        className="navbar-item button is-link is-small"
        onClick={() => setModalIsOpen(true)}
      >
        {t("trn.add")}
      </button>

      <Modal
        appElement={
          document.getElementById("root") || document.createElement("div")
        }
        isOpen={modalIsOpen}
        onRequestClose={() => setModalIsOpen(false)}
      >
        <header className="modal-card-head">
          <p className="modal-card-title">Add Transaction</p>
        </header>
        <form onSubmit={handleSubmit(onSubmit)} style={{ marginTop: "10px" }}>
          <div
            className="form-columns"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div
              className="form-column"
              style={{
                flex: 1,
                minWidth: "300px",
              }}
            >
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                {t("trn.type")}
                <TradeTypeController
                  name="type"
                  control={control}
                  options={options}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                {t("trn.asset.code")}
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
                      className="input is-1"
                      onFocus={(event) => event.target.select()}
                      onChange={(event) => {
                        event.target.value = event.target.value.toUpperCase()
                        field.onChange(event)
                      }}
                    />
                  )}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                {t("trn.currency")}
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
                        field.onChange(toCurrency(event!!.value, currencies))
                      }}
                    />
                  )}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                {t("quantity")}
                <Controller
                  name="quantity"
                  defaultValue={defaultValues.quantity}
                  control={control}
                  render={({ field }) => (
                    <input
                      {...field}
                      type="number"
                      className="input is-1"
                      onFocus={(event) => event.target.select()}
                    />
                  )}
                />
              </div>
            </div>
            <div
              className="form-column"
              style={{
                flex: 1,
                minWidth: "300px",
              }}
            >
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                {t("trn.tradeDate")}
                {errors.tradeDate && (
                  <p className="error">{errors.tradeDate.message}</p>
                )}
                <Controller
                  name="tradeDate"
                  control={control}
                  render={({ field }) => (
                    <input {...field} type="date" className="input is-3" />
                  )}
                />
              </div>
              <div className="form-group" style={{ marginBottom: "1rem" }}>
                {t("trn.market.code")}
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
                        event.target.value = event.target.value.toUpperCase()
                        field.onChange(event)
                      }}
                      className="input is-1"
                    />
                  )}
                />
              </div>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: "1rem" }}>
            {t("trn.price")}
            <Controller
              name="price"
              control={control}
              defaultValue={defaultValues.price}
              render={({ field }) => (
                <input
                  {...field}
                  type="number"
                  className="input is-1"
                  onFocus={(event) => event.target.select()}
                />
              )}
            />
          </div>
          <div className="form-group" style={{ marginBottom: "1rem" }}>
            {t("trn.amount.charges")}
            <Controller
              name="fees"
              defaultValue={defaultValues.fees}
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="number"
                  className="input is-3"
                  onFocus={(event) => event.target.select()}
                />
              )}
            />
          </div>
          <div className="form-group" style={{ marginBottom: "1rem" }}>
            {t("trn.amount.tax")}
            <Controller
              name="tax"
              defaultValue={defaultValues.tax}
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="number"
                  className="input is-3"
                  onFocus={(event) => event.target.select()}
                />
              )}
            />
          </div>
          <div className="form-group" style={{ marginBottom: "1rem" }}>
            {t("trn.amount.trade")}
            <Controller
              name="tradeAmount"
              defaultValue={defaultValues.tradeAmount}
              control={control}
              render={({ field }) => (
                <input
                  {...field}
                  type="number"
                  className="input is-3"
                  onFocus={(event) => event.target.select()}
                />
              )}
            />
          </div>
          <div className="space-top" />
          <div className="field has-margin-top-10">
            <div className="field is-grouped is-grouped-right">
              <button type="submit" className="button is-link">
                Submit
              </button>
              <button
                type="button"
                className="button is-link is-light"
                onClick={() => setModalIsOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
          <div>{errorString}</div>
        </form>
      </Modal>
    </div>
  )
}

export default TrnInputForm
