import * as yup from "yup"

export const CurrencyOptionSchema = yup.object().shape({
  label: yup.string().required(),
  value: yup.string().required(),
})

export const CategoryOptionSchema = yup.object().shape({
  label: yup.string().required(),
  value: yup.string().required(),
})

export const accountInputSchema = yup
  .object({
    code: yup.string().trim().required().min(3).max(20),
    name: yup.string().trim().required().min(5).max(50),
    currency: CurrencyOptionSchema.required(),
    category: CategoryOptionSchema.required(),
  })
  .required()

// Asset category options for user-owned custom assets
export const assetCategoryOptions = [
  { value: "ACCOUNT", label: "Bank Account" },
  { value: "RE", label: "Real Estate" },
  { value: "MUTUAL FUND", label: "Mutual Fund" },
  { value: "POLICY", label: "Insurance Policy" },
]
