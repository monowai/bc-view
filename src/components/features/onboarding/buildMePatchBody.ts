/**
 * Build the PATCH body for `/api/me` on onboarding completion.
 *
 * When `independencePlanEnabled` is true, the user filled in their date
 * of birth and target independence age on the Independence step; mirror
 * those onto the svc-data master `UserPreferences` so age-driven
 * projections (svc-retire) resolve real values instead of the defaults
 * (currentYear-55 / target 65). See bc-claude/USER_PROFILE.md.
 */
export interface OnboardingMePatchInput {
  preferredName: string
  baseCurrency: string
  reportingCurrency: string
  independencePlanEnabled: boolean
  independenceYearOfBirth: number
  independenceMonthOfBirth: number
  independenceTargetAge: number
}

export interface OnboardingMePatchBody {
  preferredName?: string
  baseCurrencyCode: string
  reportingCurrencyCode: string
  yearOfBirth?: number
  monthOfBirth?: number
  targetIndependenceAge?: number
}

export function buildMePatchBody(
  input: OnboardingMePatchInput,
): OnboardingMePatchBody {
  return {
    preferredName: input.preferredName || undefined,
    baseCurrencyCode: input.baseCurrency,
    reportingCurrencyCode: input.reportingCurrency,
    ...(input.independencePlanEnabled && {
      yearOfBirth: input.independenceYearOfBirth,
      monthOfBirth: input.independenceMonthOfBirth,
      targetIndependenceAge: input.independenceTargetAge,
    }),
  }
}
