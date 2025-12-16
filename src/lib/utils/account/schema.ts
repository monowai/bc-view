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
