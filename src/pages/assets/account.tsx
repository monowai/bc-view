import React, { useMemo, useEffect, useState } from "react"
import { Controller, SubmitHandler, useForm } from "react-hook-form"
import {
  AssetCategory,
  AssetRequest,
  AssetResponse,
  CurrencyOption,
  PolicyType,
  SubAccountRequest,
} from "types/beancounter"
import { ccyKey, categoriesKey, simpleFetcher } from "@utils/api/fetchHelper"
import { useRouter } from "next/router"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { rootLoader } from "@components/ui/PageLoader"
import { errorOut } from "@components/errors/ErrorOut"
import useSwr from "swr"
import { currencyOptions } from "@lib/currency"
import ReactSelect from "react-select"
import { yupResolver } from "@hookform/resolvers/yup"
import { validateInput } from "@components/errors/validator"
import { accountInputSchema } from "@lib/account/schema"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import CompositeAssetEditor from "@components/features/assets/CompositeAssetEditor"
import { usePortfolios } from "@hooks/usePortfolios"
import { showPortfolioPicker, solePortfolio } from "@lib/user/zenMode"
import { buildCompositeBalanceTrn } from "@utils/trns/compositeBalanceTrn"
import PortfolioPickerDialog from "@components/features/portfolios/PortfolioPickerDialog"

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
    const { preferences, isLoading: prefsLoading } = useUserPreferences()
    const { portfolios } = usePortfolios()

    // When a composite policy (CPF) is created in master mode we can't pick the
    // target portfolio for the user — prompt with the shared picker. Zen-mode
    // users (sole portfolio) are auto-linked without a prompt. Holds the
    // already-built BALANCE trn so the picker only has to supply a portfolioId.
    const [pendingLink, setPendingLink] = useState<{
      assetName: string
      trnRow: NonNullable<ReturnType<typeof buildCompositeBalanceTrn>>
    } | null>(null)

    // Get category from query param (e.g., /assets/account?category=POLICY)
    const categoryFromQuery = router.query.category as string | undefined

    // Composite policy state (managed outside react-hook-form)
    const [policyType, setPolicyType] = useState<PolicyType | undefined>(
      undefined,
    )
    const [lockedUntilDate, setLockedUntilDate] = useState("")
    const [subAccounts, setSubAccounts] = useState<SubAccountRequest[]>([])
    const [cpfLifePlan, setCpfLifePlan] = useState<
      "STANDARD" | "BASIC" | "ESCALATING" | undefined
    >(undefined)
    const [cpfPayoutStartAge, setCpfPayoutStartAge] = useState<
      number | undefined
    >(undefined)

    const {
      formState: { errors },
      control,
      register,
      getValues,
      watch,
      setValue,
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

    // Set default currency from user preferences
    useEffect(() => {
      if (preferences?.reportingCurrencyCode && ccyResponse.data?.data) {
        const ccyOpts = currencyOptions(ccyResponse.data.data)
        const defaultCurrency = ccyOpts.find(
          (c: CurrencyOption) => c.value === preferences.reportingCurrencyCode,
        )
        if (defaultCurrency) {
          setValue("currency", defaultCurrency)
        }
      }
    }, [preferences?.reportingCurrencyCode, ccyResponse.data?.data, setValue])

    // Set default category from query param
    useEffect(() => {
      if (categoryFromQuery && categoryOptions.length > 0) {
        const matchingCategory = categoryOptions.find(
          (c: CategoryOption) => c.value === categoryFromQuery,
        )
        if (matchingCategory) {
          setValue("category", matchingCategory)
        }
      }
    }, [categoryFromQuery, categoryOptions, setValue])

    const goToAccounts = (): void => {
      router.push("/accounts").then()
    }

    const postLink = async (
      portfolioId: string,
      trnRow: NonNullable<ReturnType<typeof buildCompositeBalanceTrn>>,
    ): Promise<void> => {
      try {
        await fetch("/api/trns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ portfolioId, data: [trnRow] }),
        })
      } catch (err) {
        console.error("Failed to link asset to portfolio:", err)
      }
    }

    // Link a freshly-created composite policy (CPF) to a portfolio. Zen-mode
    // users with a sole portfolio are auto-linked; master-mode users are
    // prompted via PortfolioPickerDialog. Returns true when a prompt is now
    // pending (caller must not redirect yet).
    const linkAfterCreate = async (
      assetId: string,
      formData: AccountFormInput,
    ): Promise<boolean> => {
      const trnRow =
        formData.category.value === "POLICY" && policyType
          ? buildCompositeBalanceTrn({
              assetId,
              assetName: formData.name,
              currency: formData.currency.value,
              tradeDate: new Date().toISOString().slice(0, 10),
              subAccounts,
            })
          : null

      if (!trnRow || portfolios.length === 0) return false

      if (!showPortfolioPicker(portfolios, preferences)) {
        const sole = solePortfolio(portfolios)
        if (sole) {
          await postLink(sole.id, trnRow)
          return false
        }
      }
      setPendingLink({ assetName: formData.name, trnRow })
      return true
    }

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

                // Save payout config for POLICY category
                if (formData.category.value === "POLICY") {
                  try {
                    const configPayload: Record<string, unknown> = {
                      isPension: false,
                    }

                    if (policyType) {
                      configPayload.policyType = policyType
                      configPayload.lockedUntilDate = lockedUntilDate || null
                      configPayload.subAccounts = subAccounts
                      if (cpfLifePlan) {
                        configPayload.cpfLifePlan = cpfLifePlan
                      }
                      if (cpfPayoutStartAge != null) {
                        configPayload.cpfPayoutStartAge = cpfPayoutStartAge
                      }
                    }

                    await fetch(`/api/assets/config/${createdAsset.id}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(configPayload),
                    })
                  } catch (err) {
                    console.error("Failed to save asset config:", err)
                  }
                }

                const pending = await linkAfterCreate(createdAsset.id, formData)
                if (!pending) goToAccounts()
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
        "Error creating asset",
        ccyResponse.error || categoriesResponse.error || sectorsResponse.error,
      )
    }
    if (
      prefsLoading ||
      ccyResponse.isLoading ||
      categoriesResponse.isLoading ||
      sectorsResponse.isLoading
    ) {
      return rootLoader("Loading...")
    }

    const ccyOptions = currencyOptions(ccyResponse.data.data)

    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">{"Add Asset"}</h1>
        <form className="max-w-lg mx-auto bg-white p-6 rounded shadow-md">
          <label className="block text-gray-700 text-sm font-bold mb-2">
            {"Asset Type"}
          </label>
          <Controller
            name="category"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <ReactSelect
                {...field}
                options={categoryOptions}
                placeholder={"Select the type of asset"}
              />
            )}
          />
          <div className="text-red-500 text-xs italic">
            {errors?.category?.message}
          </div>

          <label className="block text-gray-700 text-sm font-bold mb-2 mt-4">
            {"Asset Code"}
          </label>
          <input
            {...register("code")}
            type="text"
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            autoFocus={true}
            placeholder={"Unique identifier (e.g., SAVINGS, MY-HOUSE)"}
          />
          <div className="text-red-500 text-xs italic">
            {errors?.code?.message}
          </div>

          <label className="block text-gray-700 text-sm font-bold mb-2 mt-4">
            {"Asset Name"}
          </label>
          <input
            {...register("name")}
            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            type="text"
            placeholder={
              "Descriptive name (e.g., My USD Savings, Main Residence)"
            }
          />
          <div className="text-red-500 text-xs italic">
            {errors?.name?.message}
          </div>

          <label className="block text-gray-700 text-sm font-bold mb-2 mt-4">
            {"Currency"}
          </label>
          <Controller
            name="currency"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <ReactSelect
                {...field}
                options={ccyOptions}
                placeholder={"Select a Currency"}
              />
            )}
          />

          {/* Only show sector for MUTUAL FUND category */}
          {watch("category")?.value === "MUTUAL FUND" && (
            <>
              <label className="block text-gray-700 text-sm font-bold mb-2 mt-4">
                {"Sector"}
              </label>
              <Controller
                name="sector"
                control={control}
                render={({ field }) => (
                  <ReactSelect
                    {...field}
                    options={sectorOptions}
                    isClearable
                    placeholder={"Select sector (optional)"}
                  />
                )}
              />
            </>
          )}

          {/* Composite policy settings for POLICY category */}
          {watch("category")?.value === "POLICY" && (
            <div className="mt-6 p-4 rounded-lg border bg-blue-50 border-blue-200">
              <h3 className="font-medium text-gray-900 mb-4 flex items-center">
                <i className="fas fa-piggy-bank text-blue-500 mr-2"></i>
                {"Policy Settings"}
              </h3>

              <CompositeAssetEditor
                policyType={policyType}
                lockedUntilDate={lockedUntilDate}
                subAccounts={subAccounts}
                cpfLifePlan={cpfLifePlan}
                cpfPayoutStartAge={cpfPayoutStartAge}
                onPolicyTypeChange={setPolicyType}
                onLockedUntilDateChange={setLockedUntilDate}
                onSubAccountsChange={setSubAccounts}
                onCpfLifePlanChange={setCpfLifePlan}
                onCpfPayoutStartAgeChange={setCpfPayoutStartAge}
              />

              <p className="text-xs text-gray-500 mt-4">
                <i className="fas fa-info-circle mr-1"></i>
                Payout settings (age, monthly amount, return rates) can be
                configured after creation via the edit dialog.
              </p>
            </div>
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
              {"Submit"}
            </button>
            <button
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              onClick={(e) => {
                e.preventDefault()
                router.push("/accounts").then()
              }}
            >
              {"Cancel"}
            </button>
          </div>
        </form>

        {pendingLink && (
          <PortfolioPickerDialog
            title={`Add ${pendingLink.assetName} to a portfolio`}
            prompt="Which portfolio do you want to add this to?"
            portfolios={portfolios}
            onClose={() => {
              setPendingLink(null)
              goToAccounts()
            }}
            onSelect={(p) => {
              const { trnRow } = pendingLink
              setPendingLink(null)
              postLink(p.id, trnRow).finally(goToAccounts)
            }}
          />
        )}
      </div>
    )
  },
)
