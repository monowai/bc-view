import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const monthlySalary = req.query.monthlySalary as string
    const age = req.query.age as string
    return getRetireUrl(
      `/cpf/contribution-preview?monthlySalary=${encodeURIComponent(monthlySalary)}&age=${encodeURIComponent(age)}`,
    )
  },
  methods: ["GET"],
})
