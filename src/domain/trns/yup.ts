import * as yup from "yup";

export const trnEditSchema = yup.object().shape({
  trnType: yup.string().required(),
  tradeCurrency: yup.string().required(),
  cashCurrency: yup.string(),
  quantity: yup
    .number()
    .test("quantity", "Quantity can only have 5 digits or less after decimal", (value) =>
      /^\d+(\.\d{1,5})?$/.test("" + value)
    ),

  tradeAmount: yup
    .number()
    .test("tradeAmount", "Trade amount can only have 2 digits or less after decimal", (value) =>
      /^\d+(\.\d{1,2})?$/.test("" + value)
    ),

  cashAmount: yup
    .number()
    .test("cashAmount", "Cash amount can only have 2 digits or less after decimal", (value) =>
      /^-?\d+(\.\d{1,2})?$/.test("" + value)
    ),

  fees: yup
    .number()
    .test("fees", "Fees can only have 2 digits or less after decimal", (value) =>
      /^\d+(\.\d{1,2})?$/.test("" + value)
    ),
  tax: yup
    .number()
    .test("fees", "Tax can only have 2 digits or less after decimal", (value) =>
      /^\d+(\.\d{1,2})?$/.test("" + value)
    ),

  price: yup
    .number()
    .test("price", "Price can only have 4 digits or less after decimal", (value) =>
      /^\d+(\.\d{1,4})?$/.test("" + value)
    ),
  tradeBaseRate: yup
    .number()
    .test(
      "maxDigitsAfterDecimal",
      "Rate field can only have 5 digits or less after decimal",
      (value) => /^\d+(\.\d{1,5})?$/.test("" + value)
    ),

  tradeCashRate: yup
    .number()
    .test(
      "maxDigitsAfterDecimal",
      "Rate field can only have 5 digits or less after decimal",
      (value) => /^\d+(\.\d{1,5})?$/.test("" + value)
    ),
  tradePortfolioRate: yup
    .number()
    .test(
      "maxDigitsAfterDecimal",
      "Rate field can only have 5 digits or less after decimal",
      (value) => /^\d+(\.\d{1,5})?$/.test("" + value)
    ),
});
