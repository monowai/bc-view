import React, { useEffect } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import OnboardingWizard from "@components/features/onboarding/OnboardingWizard"
import { useRegistration } from "@contexts/RegistrationContext"

function OnboardingPage(): React.ReactElement {
  const { t } = useTranslation("onboarding")
  const router = useRouter()
  const { isOnboardingComplete } = useRegistration()

  useEffect(() => {
    // If onboarding already complete, redirect to wealth
    if (isOnboardingComplete) {
      router.replace("/wealth")
    }
  }, [isOnboardingComplete, router])

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
