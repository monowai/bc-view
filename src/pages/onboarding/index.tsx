import React, { useEffect } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import useSwr from "swr"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { Portfolio } from "types/beancounter"
import OnboardingWizard from "@components/features/onboarding/OnboardingWizard"
import { useRegistration } from "@contexts/RegistrationContext"

function OnboardingPage(): React.ReactElement {
  const { t } = useTranslation("onboarding")
  const router = useRouter()
  const { isOnboardingComplete, isRegistered } = useRegistration()

  // Check if user has portfolios
  const { data: portfoliosData } = useSwr<{ data: Portfolio[] }>(
    isRegistered ? portfoliosKey : null,
    simpleFetcher(portfoliosKey),
  )

  useEffect(() => {
    // Only redirect if onboarding complete AND user has portfolios
    // This allows users with no portfolios to run onboarding even if flag is set
    if (
      isOnboardingComplete &&
      portfoliosData?.data &&
      portfoliosData.data.length > 0
    ) {
      router.replace("/")
    }
  }, [isOnboardingComplete, portfoliosData, router])

  return (
    <div className="w-full py-8 px-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">
          {t("title", "Account Setup")}
        </h1>
        <p className="text-gray-600 mt-2">
          {t("subtitle", "Let's get your account ready")}
        </p>
      </div>

      {/* Wizard */}
      <OnboardingWizard />
    </div>
  )
}

export default withPageAuthRequired(OnboardingPage)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, [
      "common",
      "onboarding",
    ])),
  },
})
