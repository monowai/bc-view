import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"
import { CPF_CURRENCY } from "@utils/independence/cpf"

export default createApiHandler({
  url: (req) => {
    const { salary, age, currency } = req.query
    const salaryCurrency =
      typeof currency === "string" && currency ? currency : CPF_CURRENCY
    return getRetireUrl(
      `/projection/defined-contribution?salary=${salary}&age=${age}&currency=${encodeURIComponent(salaryCurrency)}`,
    )
  },
  methods: ["GET"],
})
