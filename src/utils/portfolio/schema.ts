import * as yup from "yup";

export const CurrencyOptionSchema = yup.object().shape({
  label: yup.string().required(),
  value: yup.string().required(),
});

export const portfolioInputSchema = yup
  .object({
    code: yup.string().trim().required().min(3).max(6),
    name: yup.string().trim().required().min(5).max(50),
    currency: CurrencyOptionSchema.required(),
    base: CurrencyOptionSchema.required(),
  })
  .required();
