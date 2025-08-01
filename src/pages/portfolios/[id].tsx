import React, { useState } from "react"
import { Controller, SubmitHandler, useForm } from "react-hook-form"
import {
  Portfolio,
  PortfolioInput,
  PortfolioRequest,
  PortfolioRequests,
} from "types/beancounter"
import { ccyKey, portfolioKey, simpleFetcher } from "@utils/api/fetchHelper"
import { useRouter } from "next/router"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import Link from "next/link"
import { rootLoader } from "@components/PageLoader"
import errorOut from "@components/errors/ErrorOut"
import useSwr from "swr"
import { currencyOptions, toCurrency, toCurrencyOption } from "@utils/currency"
import ReactSelect from "react-select"
import { yupResolver } from "@hookform/resolvers/yup"
import { validateInput } from "@components/errors/validator"
import { portfolioInputSchema } from "@utils/portfolio/schema"
import TrnDropZone from "@components/DropZone"

export default withPageAuthRequired(function Manage(): React.ReactElement {
  function toPortfolioRequest(portfolio: PortfolioInput): PortfolioRequest {
    return {
      code: portfolio.code,
      name: portfolio.name,
      currency: portfolio.currency.value,
      base: portfolio.base.value,
    }
  }

  function toPortfolioRequests(portfolio: PortfolioInput): PortfolioRequests {
    return {
      data: [toPortfolioRequest(portfolio)],
    }
  }

  const handleSubmit: SubmitHandler<PortfolioInput> = (portfolioInput) => {
    validateInput(portfolioInputSchema, portfolioInput)
      .then(() => {
        const post = router.query.id === "__NEW__"
        fetch(key, {
          method: post ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: post
            ? JSON.stringify(toPortfolioRequests(portfolioInput))
            : JSON.stringify(toPortfolioRequest(portfolioInput)),
        })
          .catch((err) => {
            throw err
          })
          .then((response) => response.json())
          .then((data) => {
            const route = post
              ? `/portfolios/${data.data[0].id}`
              : `/portfolios/${data.data.id}`
            router.push(route).then(() => {})
          })
      })
      .catch((e) => {
        console.error(`Some error ${e.message}`)
      })
  }

  const router = useRouter()
  const { t, ready } = useTranslation("common")
  const [purgeTrn, setPurgeTrn] = useState(false)
  const {
    formState: { errors },
    control,
    register,
    getValues,
  } = useForm<PortfolioInput>({
    resolver: yupResolver(portfolioInputSchema),
    mode: "onChange",
  })
  const key = portfolioKey(`${router.query.id}`)
  const { data, error } = useSwr(key, simpleFetcher(key))
  const ccyResponse = useSwr(ccyKey, simpleFetcher(ccyKey))
  if (ccyResponse.error) {
    return errorOut(t("portfolio.error.retrieve"), ccyResponse.error)
  }
  if (error) {
    return errorOut(t("portfolio.error.retrieve"), error)
  }
  if (!ready || !data || ccyResponse.isLoading) {
    return rootLoader(t("loading"))
  }
  const portfolio: Portfolio = data.data
  const ccyOptions = currencyOptions(ccyResponse.data.data)
  const currencies = ccyResponse.data.data
  return (
    <div className="container mx-auto p-4">
      <form className="max-w-lg mx-auto bg-white p-6 rounded shadow-md">
        <label className="block text-gray-700 text-sm font-bold mb-2">
          {t("portfolio.code")}
        </label>
        <input
          {...register("code")}
          type="text"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          autoFocus={true}
          placeholder={t("portfolio.code.hint")}
          defaultValue={portfolio.code}
        />
        <div className="text-red-500 text-xs italic">
          {errors?.code?.message}
        </div>
        <label className="block text-gray-700 text-sm font-bold mb-2">
          {t("portfolio.name")}
        </label>
        <input
          {...register("name", { required: true, maxLength: 100 })}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          type="text"
          placeholder={t("portfolio.name.hint")}
          defaultValue={portfolio.name}
        />
        <div className="text-red-500 text-xs italic">
          {errors?.name?.message}
        </div>
        <label className="block text-gray-700 text-sm font-bold mb-2">
          {t("portfolio.currency.reporting")}
        </label>
        <Controller
          name="currency"
          control={control}
          defaultValue={toCurrencyOption(portfolio.currency)}
          rules={{ required: true }}
          render={({ field }) => (
            <ReactSelect
              {...field}
              defaultValue={toCurrencyOption(portfolio.currency)}
              options={ccyOptions}
              onChange={(event) => {
                if (event) {
                  field.onChange(toCurrency(event.value, currencies))
                }
              }}
            />
          )}
        />

        <label className="block text-gray-700 text-sm font-bold mb-2">
          {t("portfolio.currency.base.label")}
        </label>
        <Controller
          name="base"
          control={control}
          rules={{ required: true }}
          defaultValue={toCurrencyOption(portfolio.base)}
          render={({ field }) => (
            <ReactSelect
              {...field}
              defaultValue={toCurrencyOption(portfolio.base)}
              options={ccyOptions}
              onChange={(event) => {
                if (event) {
                  field.onChange(toCurrency(event.value, currencies))
                }
              }}
            />
          )}
        />
        <div className="mt-4"></div>
        <div className="flex items-center justify-between mt-4">
          <button
            type="submit"
            value="submit"
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            onClick={(e) => {
              e.preventDefault()
              handleSubmit(getValues() as PortfolioInput)
            }}
          >
            {t("form.submit")}
          </button>
          <button
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            onClick={(e) => {
              e.preventDefault()
              router.push("/portfolios").then()
            }}
          >
            {t("form.cancel")}
          </button>
          <button className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
            <Link href={`/holdings/${portfolio.code}`}>
              {t("form.holdings")}
            </Link>
          </button>
        </div>
      </form>
      <div>
        <div className="flex justify-center items-center mt-10">
          <TrnDropZone portfolio={portfolio} purge={purgeTrn} />
          <label className="inline-flex items-center ml-4">
            <input
              type="checkbox"
              className="form-checkbox"
              checked={purgeTrn}
              onChange={() => setPurgeTrn(!purgeTrn)}
            />
            <span className="ml-2">{t("portfolio.delete.trns")}</span>
          </label>
        </div>
      </div>
    </div>
  )
})

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
