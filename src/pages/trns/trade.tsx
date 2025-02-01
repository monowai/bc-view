import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Portfolio } from "types/beancounter";
import { calculateTradeAmount, getTradeRow } from "@utils/trns/tradeUtils";
import { useTranslation } from "next-i18next";
import useSwr from "swr";
import { ccyKey, simpleFetcher } from "@utils/api/fetchHelper";
import { currencyOptions, toCurrencyOption } from "@components/currency";
import ReactSelect from "react-select";
import { rootLoader } from "@components/PageLoader";
import { CurrencyOptionSchema } from "@utils/portfolio/schema";
import { postData } from "@components/DropZone";
import TradeTypeController from "@components/TradeTypeController";

const TradeTypeValues = ["BUY", "SELL", "DIVI", "SPLIT"] as const;

const defaultValues = {
  type: { value: "BUY", label: "BUY" },
  asset: "",
  market: "US",
  tradeDate: new Date().toISOString().split("T")[0],
  quantity: 0,
  price: 0,
  tradeCurrency: { value: "USD", label: "USD" },
  cashCurrency: { value: "USD", label: "USD" },
  tradeAmount: 0,
  cashAmount: 0,
  fees: 0,
  tax: 0,
  comment: "",
};

const schema = yup.object().shape({
  type: yup.object().shape({
    value: yup.string().required().default(defaultValues.type.value),
    label: yup.string().required().default(defaultValues.type.label),
  }).required(),
  asset: yup.string().required(),
  market: yup.string().required(),
  tradeDate: yup.string().required(),
  quantity: yup.number().default(0).required(),
  price: yup.number().required().default(0),
  tradeAmount: yup.number(),
  cashCurrency: CurrencyOptionSchema.required(),
  cashAmount: yup.number(),
  fees: yup.number().required().default(defaultValues.fees),
  tax: yup.number().required().default(defaultValues.tax),
  comment: yup.string().notRequired(),
});

const TradeInputForm: React.FC<{ portfolio: Portfolio }> = ({ portfolio }) => {
  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    defaultValues,
  });
  const { data: ccyData, isLoading } = useSwr(ccyKey, simpleFetcher(ccyKey));
  const { t } = useTranslation("common");
  const [tradeModalOpen, setTradeModalOpen] = useState(false);

  const quantity = watch("quantity");
  const price = watch("price");
  const tax = watch("tax");
  const fees = watch("fees");
  const type = watch("type");

  useEffect(() => {
    if (quantity && price) {
      const tradeAmount = calculateTradeAmount(quantity, price, tax, fees, type.value);
      setValue("tradeAmount", parseFloat(tradeAmount.toFixed(2)));
    }
  }, [quantity, price, tax, fees, type, setValue]);

  const onSubmit = (data: any): void => {
    if (Object.keys(errors).length > 0) {
      console.log("Validation errors:", errors);
      return;
    }
    const row = getTradeRow(data);
    if (window.confirm(`Do you want to submit the transaction?`)) {
      postData(portfolio, false, row.split(",")).then(console.log);
      setTradeModalOpen(false);
    } else {
      console.log("Transaction submission canceled");
    }
  };

  if (isLoading) return rootLoader(t("loading"));

  const ccyOptions = currencyOptions(ccyData.data);

  return (
      <div>
        <button className="bg-blue-500 text-white px-4 py-1 rounded" onClick={() => setTradeModalOpen(true)}>
          {t("trn.trade")}
        </button>

        {tradeModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="fixed inset-0 bg-black opacity-50" onClick={() => setTradeModalOpen(false)}></div>
              <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-auto p-6 z-50" onClick={(e) => e.stopPropagation()}>
                <header className="flex justify-between items-center border-b pb-2 mb-4">
                  <h2 className="text-xl font-semibold">{t("trade.title")}</h2>
                  <button className="text-gray-500 hover:text-gray-700" onClick={() => setTradeModalOpen(false)}>
                    &times;
                  </button>
                </header>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { name: "type", label: t("trn.type"), component: <TradeTypeController name="type" control={control} options={TradeTypeValues.map(value => ({ value, label: value }))} className="input-height" /> },
                      { name: "tradeDate", label: t("trn.tradeDate"), component: <Controller name="tradeDate" control={control} render={({ field }) => <input {...field} type="date" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height" />} /> },
                      { name: "cashCurrency", label: t("trn.currency.cash"), component: <Controller name="cashCurrency" control={control} defaultValue={toCurrencyOption(portfolio.currency)} render={({ field }) => <ReactSelect {...field} options={ccyOptions} className="mt-1 input-height" />} /> },
                      { name: "cashAmount", label: t("trn.amount.cash"), component: <Controller name="cashAmount" control={control} render={({ field }) => <input {...field} type="number" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height" />} /> },
                      { name: "asset", label: t("trn.asset.code"), component: <Controller name="asset" control={control} render={({ field }) => <input {...field} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height" />} /> },
                      { name: "market", label: t("trn.market.code"), component: <Controller name="market" control={control} render={({ field }) => <input {...field} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height" />} /> },
                      { name: "quantity", label: t("quantity"), component: <Controller name="quantity" control={control} render={({ field }) => <input {...field} type="number" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height" />} /> },
                      { name: "price", label: t("trn.price"), component: <Controller name="price" control={control} render={({ field }) => <input {...field} type="number" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height" />} /> },
                      { name: "fees", label: t("trn.amount.charges"), component: <Controller name="fees" control={control} render={({ field }) => <input {...field} type="number" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height" />} /> },
                      { name: "tax", label: t("trn.amount.tax"), component: <Controller name="tax" control={control} render={({ field }) => <input {...field} type="number" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height" />} /> },
                      { name: "tradeAmount", label: t("trn.amount.trade"), component: <Controller name="tradeAmount" control={control} render={({ field }) => <input {...field} type="number" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height" />} /> },
                      { name: "comment", label: t("trn.comments"), component: <Controller name="comment" control={control} render={({ field }) => <input {...field} type="text" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height" />} /> },
                    ].map(({ name, label, component }) => (
                        <div key={name}>
                          <label className="block text-sm font-medium text-gray-700">{label}</label>
                          {errors[name] && <p className="text-red-500 text-xs">{errors[name]?.message}</p>}
                          {component}
                        </div>
                    ))}
                  </div>
                  <div className="text-red-500 text-xs">{Object.values(errors).map(error => error?.message).join(" ")}</div>
                  <div className="flex justify-end space-x-2">
                    <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Submit</button>
                    <button type="button" className="bg-gray-300 text-gray-700 px-4 py-2 rounded" onClick={() => setTradeModalOpen(false)}>Cancel</button>
                  </div>
                </form>
              </div>
            </div>
        )}
      </div>
  );
};

export default TradeInputForm;
