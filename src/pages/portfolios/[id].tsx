import React, { useState, useMemo } from "react"
import { Controller, SubmitHandler, useForm } from "react-hook-form"
import {
  Currency,
  Portfolio,
  PortfolioInput,
  PortfolioRequest,
  PortfolioRequests,
} from "types/beancounter"
import { ccyKey, portfolioKey, simpleFetcher } from "@utils/api/fetchHelper"
import { useRouter } from "next/router"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Link from "next/link"
import { rootLoader } from "@components/ui/PageLoader"
import { errorOut } from "@components/errors/ErrorOut"
import useSwr from "swr"
import { currencyOptions, toCurrency, toCurrencyOption } from "@lib/currency"
import ReactSelect from "react-select"
import { yupResolver } from "@hookform/resolvers/yup"
import { validateInput } from "@components/errors/validator"
import { portfolioInputSchema } from "@lib/portfolio/schema"
import TrnDropZone from "@components/ui/DropZone"
import { useUserPreferences } from "@contexts/UserPreferencesContext"

export default withPageAuthRequired(function Manage(): React.ReactElement {
  function toPortfolioRequest(portfolio: PortfolioInput): PortfolioRequest {
    return {
      code: portfolio.code,
      name: portfolio.name,
      currency: portfolio.currency.value,
      base: portfolio.base.value,
      active: portfolio.active,
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
  const { preferences } = useUserPreferences()
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
  const isNewPortfolio = router.query.id === "__NEW__"
  const key = portfolioKey(`${router.query.id}`)
  const defaultPortfolio = {
    data: {
      id: "",
      code: "",
      name: "",
      currency: { id: "USD", code: "USD", symbol: "$" },
      base: { id: "USD", code: "USD", symbol: "$" },
    },
  }
  const { data, error } = useSwr(
    isNewPortfolio ? null : key,
    simpleFetcher(key),
    isNewPortfolio ? { fallbackData: defaultPortfolio } : undefined,
  )
  const ccyResponse = useSwr(ccyKey, simpleFetcher(ccyKey))

  // Get the default base currency - use user preference for new portfolios
  const defaultBaseCurrency = useMemo((): Currency | undefined => {
    if (!ccyResponse.data?.data) return undefined

    if (isNewPortfolio && preferences?.baseCurrencyCode) {
      const preferredCurrency = ccyResponse.data.data.find(
        (c: Currency) => c.code === preferences.baseCurrencyCode,
      )
      if (preferredCurrency) return preferredCurrency
    }

    return data?.data?.base
  }, [
    isNewPortfolio,
    preferences?.baseCurrencyCode,
    ccyResponse.data?.data,
    data?.data?.base,
  ])

  if (ccyResponse.error) {
    return errorOut("Error retrieving currency data", ccyResponse.error)
  }
  if (error) {
    return errorOut(`Error retrieving portfolio ${router.query.id}`, error)
  }
  if (!data || ccyResponse.isLoading) {
    return rootLoader("Loading...")
  }
  const portfolio: Portfolio = data.data
  const ccyOptions = currencyOptions(ccyResponse.data.data)
  const currencies = ccyResponse.data.data
  return (
    <div className="container mx-auto p-4">
      <form className="max-w-lg mx-auto bg-white p-6 rounded shadow-md">
        <label className="block text-gray-700 text-sm font-bold mb-2">
          {"Code"}
        </label>
        <input
          {...register("code")}
          type="text"
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          autoFocus={true}
          placeholder={"Unique short identifier"}
          defaultValue={portfolio.code}
        />
        <div className="text-red-500 text-xs italic">
          {errors?.code?.message}
        </div>
        <label className="block text-gray-700 text-sm font-bold mb-2">
          {"Name"}
        </label>
        <input
          {...register("name", { required: true, maxLength: 100 })}
          className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
          type="text"
          placeholder={"Descriptive name"}
          defaultValue={portfolio.name}
        />
        <div className="text-red-500 text-xs italic">
          {errors?.name?.message}
        </div>
        <label className="block text-gray-700 text-sm font-bold mb-2">
          {"Portfolio Reporting Currency"}
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
          {"Cost Currency"}
        </label>
        <Controller
          name="base"
          control={control}
          rules={{ required: true }}
          defaultValue={toCurrencyOption(defaultBaseCurrency || portfolio.base)}
          render={({ field }) => (
            <ReactSelect
              {...field}
              defaultValue={toCurrencyOption(
                defaultBaseCurrency || portfolio.base,
              )}
              options={ccyOptions}
              onChange={(event) => {
                if (event) {
                  field.onChange(toCurrency(event.value, currencies))
                }
              }}
            />
          )}
        />
        <div className="mt-4">
          <label className="flex items-center cursor-pointer">
            <input
              {...register("active")}
              type="checkbox"
              className="form-checkbox h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              defaultChecked={
                isNewPortfolio ? true : portfolio.active !== false
              }
            />
            <span className="ml-2 text-gray-700 text-sm font-bold">
              {"Active"}
            </span>
          </label>
          <p className="text-gray-500 text-xs mt-1 ml-7">
            {"Inactive portfolios are hidden from lists and aggregations"}
          </p>
        </div>
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
            {"Submit"}
          </button>
          <button
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
            onClick={(e) => {
              e.preventDefault()
              router.push("/portfolios").then()
            }}
          >
            {"Cancel"}
          </button>
          <Link
            href={`/holdings/${portfolio.code}`}
            className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
          >
            {"Holdings"}
          </Link>
        </div>
      </form>
      <div className="max-w-lg mx-auto mt-6">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <p className="text-sm text-gray-500 mb-4">
            {"Import transactions from a CSV file to add holdings"}
          </p>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 inline-block cursor-pointer hover:border-gray-400 transition-colors">
            <i className="fas fa-file-csv text-4xl text-gray-400 mb-2"></i>
            <TrnDropZone
              portfolio={portfolio}
              purge={purgeTrn}
              hideIcon={true}
            />
            <p className="text-sm text-gray-500 mt-2">
              {"Click or drop a CSV file here"}
            </p>
          </div>
          <label className="flex items-center justify-center mt-4">
            <input
              type="checkbox"
              className="form-checkbox"
              checked={purgeTrn}
              onChange={() => setPurgeTrn(!purgeTrn)}
            />
            <span className="ml-2 text-sm text-gray-600">
              {"Delete existing transactions"}
            </span>
          </label>
        </div>
      </div>
    </div>
  )
})
