import { asScalar, createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"
import { CPF_CURRENCY } from "@utils/independence/cpf"

export default createApiHandler({
  url: (req) => {
    const monthlySalary = asScalar(req.query.monthlySalary)
    const age = asScalar(req.query.age)
    const currency = asScalar(req.query.currency) || CPF_CURRENCY
    return getRetireUrl(
      `/cpf/contribution-preview?monthlySalary=${encodeURIComponent(monthlySalary)}&age=${encodeURIComponent(age)}&currency=${encodeURIComponent(currency)}`,
    )
  },
  methods: ["GET"],
})
