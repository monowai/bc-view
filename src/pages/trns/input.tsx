import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Modal from "react-modal";
import { Portfolio } from "@components/types/beancounter";
import { useTranslation } from "next-i18next";
import Select from "react-select";
import useSwr from "swr";
import { ccyKey, simpleFetcher } from "@utils/api/fetchHelper";
import {
  currencyOptions,
  toCurrency,
  toCurrencyOption,
} from "@components/currency";
import ReactSelect from "react-select";
import { rootLoader } from "@components/PageLoader";
import { CurrencyOptionSchema } from "@utils/portfolio/schema";
import { postData } from "@components/DropZone";

interface TrnInputFormProps {
  portfolio: Portfolio;
  isOpen: boolean;
  closeModal: () => void;
}

// Define validation schema with Yup
const schema = yup.object().shape({
  type: yup.string().required(),
  asset: yup.string().required(),
  market: yup.string().required(),
  tradeDate: yup.string().required(),
  quantity: yup.number().required(),
  price: yup.number().required(),
  tradeAmount: yup.number(),
  tradeCurrency: CurrencyOptionSchema.required(),
  tradeBaseRate: yup.number(),
  tradePortfolioRate: yup.number(),
  cashCurrency: yup.string(),
  cashAmount: yup.number(),
  tradeCashRate: yup.number(),
  fees: yup.number().required().default(0),
  tax: yup.number().required().default(0),
});

const TrnInputForm: React.FC<TrnInputFormProps> = ({ portfolio }) => {
  const TrnTypeValues = ["BUY", "SELL", "DIVI", "SPLIT"] as const;

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: yupResolver(schema),
    defaultValues: { type: TrnTypeValues[0].valueOf() },
  });
  const ccyResponse = useSwr(ccyKey, simpleFetcher(ccyKey));
  const options = TrnTypeValues.map((value) => ({ value, label: value }));
  const { t } = useTranslation("common");
  const [modalIsOpen, setModalIsOpen] = useState(false);

  const quantity = watch("quantity");
  const price = watch("price");
  const tax = watch("tax");
  const fees = watch("fees");

  useEffect(() => {
    if (quantity && price) {
      const tradeAmount = quantity * price - tax - fees;
      setValue("tradeAmount", tradeAmount);
    }
  }, [quantity, price, tax, fees, setValue]);

  const onSubmit = (data: any): void => {
    data.cashCurrency = data.tradeCurrency;
    const date = new Date();
    const year = date.getFullYear();
    const month = ("0" + (date.getMonth() + 1)).slice(-2); // Months are 0-based in JavaScript
    const day = ("0" + date.getDate()).slice(-2);
    const formattedDate = `${year}${month}${day}`;
    const row = `${formattedDate},,${data.type},${data.market},${data.asset},,,${data.cashCurrency.value},${data.tradeDate},${data.quantity},,${data.tradeCurrency.value},${data.price},${data.fees},,,,`;
    postData(portfolio, false, row.split(",")).then(r => console.log(r));
    setModalIsOpen(false);
  };
  if (ccyResponse.isLoading) {
    return rootLoader(t("loading"));
  }
  const ccyOptions = currencyOptions(ccyResponse.data.data);
  const currencies = ccyResponse.data.data;
  let errorString = "";
  Object.values(errors).forEach((error) => {
    if (error?.message) {
      errorString += error.message + " ";
    }
  });
  return (
    <div>
      <button
        className="navbar-item button is-link is-small"
        onClick={() => setModalIsOpen(true)}
      >
        {t("trn.add")}
      </button>

      <Modal
        appElement={
          document.getElementById("root") || document.createElement("div")
        }
        isOpen={modalIsOpen}
        onRequestClose={() => setModalIsOpen(false)}
      >

        <header className="modal-card-head">
          <p className="modal-card-title">Add Transaction</p>
        </header>
        <form onSubmit={handleSubmit(onSubmit)} style={{ marginTop: '10px' }}>
          <div className={"form-columns"}>
            <div className="form-column">
              {t("trn.type")}
              <Controller
                name="type"
                control={control}
                render={({field}) => (
                  <Select
                    {...field}
                    value={options[0]}
                    options={options}
                    onChange={(val) => {
                      field.onChange(val?.value);
                    }}
                  />
                )}
              />
              {t("trn.asset.code")}
              {errors.asset && <p className="error">{errors.asset.message}</p>}
              <Controller
                name="asset"
                control={control}
                defaultValue=""
                render={({field}) => (
                  <input
                    {...field}
                    className={"input is-1"}
                    onChange={(event) => {
                      event.target.value = event.target.value.toUpperCase();
                      field.onChange(event);
                    }}
                  />
                )}
              />
              {t("trn.currency")}
              <Controller
                name="tradeCurrency"
                control={control}
                defaultValue={toCurrencyOption(portfolio.currency)}
                rules={{required: true}}
                render={({field}) => (
                  <ReactSelect
                    {...field}
                    defaultValue={toCurrencyOption(portfolio.currency)}
                    options={ccyOptions}
                    onChange={(event) => {
                      field.onChange(toCurrency(event!!.value, currencies));
                    }}
                  />
                )}
              />
              {t("quantity")}
              <Controller
                name="quantity"
                control={control}
                render={({field}) => (
                  <input {...field} type={"number"} className={"input is-1"}/>
                )}
              />
            </div>
            <div className="form-column">
              {t("trn.tradeDate")}
              {errors.tradeDate && (
                <p className="error">{errors.tradeDate.message}</p>
              )}
              <Controller
                name="tradeDate"
                control={control}
                render={({field}) => (
                  <input {...field} type={"date"} className={"input is-3"}/>
                )}
              />
              {t("trn.market.code")}
              {errors.market && <p className="error">{errors.market.message}</p>}
              <Controller
                name="market"
                control={control}
                defaultValue="US"
                render={({field}) => (
                  <input
                    {...field}
                    onChange={(event) => {
                      event.target.value = event.target.value.toUpperCase();
                      field.onChange(event);
                    }}
                    className={"input is-1"}
                  />
                )}
              />
            </div>
          </div>
          {t("trn.price")}
          <Controller
            name="price"
            control={control}
            render={({field}) => (
              <input {...field} type={"number"} className={"input is-1"}/>
            )}
          />
          {t("trn.amount.charges")}
          <Controller
            name="fees"
            defaultValue={0}
            control={control}
            render={({field}) => (
              <input {...field} type={"number"} className={"input is-3"}/>
            )}
          />
          {t("trn.amount.tax")}
          <Controller
            name="tax"
            defaultValue={0}
            control={control}
            render={({field}) => (
              <input {...field} type={"number"} className={"input is-3"}/>
            )}
          />
          {t("trn.amount.trade")}
          <Controller
            name="tradeAmount"
            control={control}
            render={({field}) => (
              <input {...field} type={"number"} className={"input is-3"}/>
            )}
          />
          <div className={"space-top"}/>
          <div className="field has-margin-top-10">
            <div className="field is-grouped is-grouped-right ">
              <button type="submit" className="button is-link">
                Submit
              </button>
              <button type="button" className="button is-link is-light" onClick={() => setModalIsOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
          <div>{errorString}</div>
        </form>
      </Modal>
    </div>
  );
};

export default TrnInputForm;
