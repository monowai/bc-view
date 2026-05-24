import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

// Next.js req.query values are string | string[] | undefined. Forwarding the
// raw value to encodeURIComponent collapses arrays to "v1,v2" and undefined
// to "undefined" — neither is what svc-retire wants. Pick the first element
// of arrays, treat undefined as the empty string, so the upstream gets
// canonical scalar query params.
function asScalar(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? ""
  return value ?? ""
}

export default createApiHandler({
  url: (req) => {
    const monthlySalary = asScalar(req.query.monthlySalary)
    const age = asScalar(req.query.age)
    return getRetireUrl(
      `/cpf/contribution-preview?monthlySalary=${encodeURIComponent(monthlySalary)}&age=${encodeURIComponent(age)}`,
    )
  },
  methods: ["GET"],
})
