import * as Yup from "yup";
import { string } from "yup";

export const portfolioInputSchema = Yup.object().shape({
  code: Yup.string().label("Code").trim().required().min(3).max(6),
  name: Yup.string().label("Name").trim().required().min(5).max(50),
  currency: Yup.object({ value: string(), label: string() }).required(),
  base: Yup.object({ value: string(), label: string() }).required(),
});
