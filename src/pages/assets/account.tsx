import React, { useMemo } from "react"
import { Controller, SubmitHandler, useForm } from "react-hook-form"
import {
  AssetCategory,
  AssetRequest,
  AssetResponse,
  CurrencyOption,
} from "types/beancounter"
import { ccyKey, categoriesKey, simpleFetcher } from "@utils/api/fetchHelper"
import { useRouter } from "next/router"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import { rootLoader } from "@components/ui/PageLoader"
import { errorOut } from "@components/errors/ErrorOut"
import useSwr from "swr"
import { currencyOptions } from "@lib/currency"
import ReactSelect from "react-select"
import { yupResolver } from "@hookform/resolvers/yup"
import { validateInput } from "@components/errors/validator"
import { accountInputSchema } from "@lib/account/schema"

interface SectorInfo {
  code: string
  name: string
  standard: string
}

interface SectorOption {
  value: string
  label: string
}

// Categories that can be used for user-owned custom assets
const USER_ASSET_CATEGORIES = ["ACCOUNT", "RE", "MUTUAL FUND", "POLICY"]

interface CategoryOption {
  value: string
  label: string
}

interface AccountFormInput {
  code: string
  name: string
  currency: CurrencyOption
  category: CategoryOption
  sector?: SectorOption
}

export default withPageAuthRequired(
  function CreateAccount(): React.ReactElement {
    const router = useRouter()
    const { t, ready } = useTranslation("common")

    const {
      formState: { errors },
      control,
      register,
      getValues,
      watch,
    } = useForm<AccountFormInput>({
      resolver: yupResolver(accountInputSchema),
      mode: "onChange",
    })

    const ccyResponse = useSwr(ccyKey, simpleFetcher(ccyKey))
    const categoriesResponse = useSwr(
      categoriesKey,
      simpleFetcher(categoriesKey),
    )
    const sectorsResponse = useSwr<{ data: SectorInfo[] }>(
      "/api/classifications/sectors",
      simpleFetcher("/api/classifications/sectors"),
    )

    // Convert backend categories to select options, filtering to user asset types
    const categoryOptions = useMemo(() => {
      if (!categoriesResponse.data?.data) return []
      return categoriesResponse.data.data
        .filter((cat: AssetCategory) => USER_ASSET_CATEGORIES.includes(cat.id))
        .map((cat: AssetCategory) => ({
          value: cat.id,
          label: cat.name,
        }))
    }, [categoriesResponse.data?.data])

    // Convert sectors to select options
    const sectorOptions = useMemo(() => {
      if (!sectorsResponse.data?.data) return []
      return sectorsResponse.data.data.map((sector: SectorInfo) => ({
        value: sector.name,
        label: sector.name,
      }))
    }, [sectorsResponse.data?.data])

    const handleSubmit: SubmitHandler<AccountFormInput> = (formData) => {
      validateInput(accountInputSchema, formData)
        .then(() => {
          const assetRequest: AssetRequest = {
            data: {
              [formData.code]: {
                market: "PRIVATE",
                code: formData.code,
                name: formData.name,
                currency: formData.currency.value,
                category: formData.category.value,
                owner: "", // Backend will set this from the authenticated user
              },
            },
          }

          fetch("/api/assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(assetRequest),
          })
            .then((response) => {
              if (!response.ok) {
                console.error(`HTTP error! status: ${response.status}`)
                return undefined
              }
              return response.json()
            })
            .then(async (data: AssetResponse | undefined) => {
              if (!data) return
              const createdAsset = Object.values(data.data)[0]
              if (createdAsset) {
                // Set sector classification if provided
                if (formData.sector?.value) {
                  try {
                    await fetch(`/api/classifications/${createdAsset.id}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ sector: formData.sector.value }),
                    })
                  } catch (err) {
                    console.error("Failed to set sector classification:", err)
                  }
                }
                router.push("/accounts").then()
              }
            })
            .catch((err) => {
              console.error(`Error creating asset: ${err.message}`)
            })
        })
        .catch((e) => {
          console.error(`Validation error: ${e.message}`)
        })
    }

    if (
      ccyResponse.error ||
      categoriesResponse.error ||
      sectorsResponse.error
    ) {
      return errorOut(
        t("account.error.create"),
        ccyResponse.error || categoriesResponse.error || sectorsResponse.error,
      )
    }
    if (
      !ready ||
      ccyResponse.isLoading ||
      categoriesResponse.isLoading ||
      sectorsResponse.isLoading
    ) {
      return rootLoader(t("loading"))
    }

    const ccyOptions = currencyOptions(ccyResponse.data.data)

    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">{t("account.create")}</h1>
        <form className="max-w-lg mx-auto bg-white p-6 rounded shadow-md">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            {t("account.category")}
          </label>
          <Controller
            name="category"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <ReactSelect
                {...field}
                options={categoryOptions}
                placeholder={t("account.category.hint")}
              />
            )}
          />
          <div className="text-red-500 text-xs italic">
            {errors?.category?.message}
          </div>

          <label className="block text-gray-700 text-sm font-bold mb-2 mt-4">
            {t("account.code")}
          </label>
          <input
            {...register("code")}
            type="text"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            autoFocus={true}
            placeholder={t("account.code.hint")}
          />
          <div className="text-red-500 text-xs italic">
            {errors?.code?.message}
          </div>

          <label className="block text-gray-700 text-sm font-bold mb-2 mt-4">
            {t("account.name")}
          </label>
          <input
            {...register("name")}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            type="text"
            placeholder={t("account.name.hint")}
          />
          <div className="text-red-500 text-xs italic">
            {errors?.name?.message}
          </div>

          <label className="block text-gray-700 text-sm font-bold mb-2 mt-4">
            {t("account.currency")}
          </label>
          <Controller
            name="currency"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <ReactSelect
                {...field}
                options={ccyOptions}
                placeholder={t("portfolio.select.currency")}
              />
            )}
          />

          {/* Only show sector for MUTUAL FUND category */}
          {watch("category")?.value === "MUTUAL FUND" && (
            <>
              <label className="block text-gray-700 text-sm font-bold mb-2 mt-4">
                {t("account.sector", "Sector")}
              </label>
              <Controller
                name="sector"
                control={control}
                render={({ field }) => (
                  <ReactSelect
                    {...field}
                    options={sectorOptions}
                    isClearable
                    placeholder={t(
                      "account.sector.hint",
                      "Select sector (optional)",
                    )}
                  />
                )}
              />
            </>
          )}

          <div className="flex items-center justify-between mt-6">
            <button
              type="submit"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              onClick={(e) => {
                e.preventDefault()
                handleSubmit(getValues() as AccountFormInput)
              }}
            >
              {t("form.submit")}
            </button>
            <button
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              onClick={(e) => {
                e.preventDefault()
                router.push("/accounts").then()
              }}
            >
              {t("form.cancel")}
            </button>
          </div>
        </form>
      </div>
    )
  },
)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
