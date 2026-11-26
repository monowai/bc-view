import { asScalar, createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"
import { CPF_CURRENCY } from "@utils/independence/cpf"

export default createApiHandler({
  url: (req) => {
    const salary = asScalar(req.query.salary)
    const age = asScalar(req.query.age)
    const currency = asScalar(req.query.currency) || CPF_CURRENCY
    return getRetireUrl(
      `/projection/defined-contribution?salary=${encodeURIComponent(salary)}&age=${encodeURIComponent(age)}&currency=${encodeURIComponent(currency)}`,
    )
  },
  methods: ["GET"],
})
