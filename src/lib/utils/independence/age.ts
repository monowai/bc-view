/**
 * Compute the user's current age in whole years from any object carrying
 * the standard demographic shape (yearOfBirth + optional monthOfBirth).
 * Returns undefined when yearOfBirth is missing so callers can branch on
 * "no profile yet" vs "have a profile".
 *
 * Accepts both `UserIndependenceSettings` (svc-retire) and `UserPreferences`
 * (svc-data) since profile demographics now live on both — UserPreferences
 * is the denormalised read copy that screens scoped to svc-data (Edit Asset,
 * holdings) can read without a runtime call to svc-retire. Same year-
 * rollover rule applies regardless of source: subtract one if we haven't
 * passed the birth month yet.
 */
export interface ProfileDemographics {
  yearOfBirth?: number
  monthOfBirth?: number
}

export function currentAgeFromSettings(
  settings: ProfileDemographics | undefined | null,
): number | undefined {
  const yob = settings?.yearOfBirth
  if (!yob) return undefined
  const now = new Date()
  let age = now.getFullYear() - Number(yob)
  const monthOfBirth = settings?.monthOfBirth
  // Months stored 1-based; getMonth() is 0-based.
  if (monthOfBirth && now.getMonth() + 1 < Number(monthOfBirth)) {
    age -= 1
  }
  return age
}
