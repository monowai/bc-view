import React, { useEffect } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useRouter } from "next/router"
import useSwr from "swr"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { Portfolio } from "types/beancounter"
import OnboardingWizard from "@components/features/onboarding/OnboardingWizard"
import { useRegistration } from "@contexts/RegistrationContext"
import { useIndependencePlans } from "@hooks/useIndependencePlans"

function OnboardingPage(): React.ReactElement {
  const router = useRouter()
  const { isOnboardingComplete, isRegistered } = useRegistration()

  // Check if user has portfolios
  const { data: portfoliosData } = useSwr<{ data: Portfolio[] }>(
    isRegistered ? portfoliosKey : null,
    simpleFetcher(portfoliosKey),
  )

  // A journey counts the same as a portfolio for the bounce below: the user
  // has already built something, so re-walking the wizard can only duplicate
  // it. This is server state — the `bc_onboarding_complete` latch is per
  // browser, so it alone can't tell a returning user from a new one.
  const { plans: journeys, isLoading: journeysLoading } = useIndependencePlans()

  useEffect(() => {
    // Only redirect if onboarding is complete AND the user already has
    // something — a portfolio or an independence journey. A user with
    // neither may re-run onboarding even with the flag set.
    if (!isOnboardingComplete) return

    const hasPortfolio = (portfoliosData?.data?.length ?? 0) > 0
    // "Still loading" is not "none": waiting here is what stops the wizard
    // flashing up in front of a user who is about to be bounced.
    const hasJourney = !journeysLoading && journeys.length > 0

    if (hasPortfolio || hasJourney) {
      router.replace("/")
    }
  }, [isOnboardingComplete, journeys, journeysLoading, portfoliosData, router])

  return (
    <div className="w-full py-8 px-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">{"Account Setup"}</h1>
        <p className="text-gray-600 mt-2">{"Let's get your account ready"}</p>
      </div>

      {/* Wizard */}
      <OnboardingWizard />
    </div>
  )
}

export default withPageAuthRequired(OnboardingPage)
