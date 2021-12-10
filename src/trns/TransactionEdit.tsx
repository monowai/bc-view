import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Transaction, TrnInput } from "../types/beancounter";
import { _axios, getBearerToken } from "../common/axiosUtils";
import { useCurrencies } from "../static/hooks";
import { AxiosError } from "axios";
import { useHistory } from "react-router";
import { useKeycloak } from "@react-keycloak/ssr";
import { ErrorPage } from "../errors/ErrorPage";
import { useTransaction } from "./hooks";
import { isDone } from "../types/typeUtils";
import { currencyOptions } from "../static/IsoHelper";
import { yupResolver } from "@hookform/resolvers/yup";
import { ShowError } from "../errors/ShowError";
import { translate } from "../common/i18nUtils";
import { trnEditSchema } from "./yup";

export function TransactionEdit(portfolioId: string, trnId: string): React.ReactElement {
  const { keycloak } = useKeycloak();

  const { register, handleSubmit } = useForm<TrnInput>({
    resolver: yupResolver(trnEditSchema),
    mode: "onChange",
  });
  const trnResult = useTransaction(portfolioId, trnId);
  const currencyResult = useCurrencies();
  const [stateError, setError] = useState<AxiosError>();
  const history = useHistory();
  const [submitted, setSubmitted] = useState(false);

  const title = (): JSX.Element => {
    return (
      <section className="page-box is-centered page-title">
        {trnId === "new" ? "Create" : "Edit"} Transaction
      </section>
    );
  };

  const handleCancel = (): void => {
    history.goBack();
  };

  const deleteTransaction = handleSubmit(() => {
    if (confirm(translate("delete.trn"))) {
      _axios
        .delete<Transaction>(`/bff/trns/${trnId}`, {
          headers: getBearerToken(keycloak?.token),
        })
        .then(() => {
          console.debug("<<delete Trn");
          setSubmitted(true);
        })
        .catch((err) => {
          setError(err);
          if (err.response) {
            console.error("deleteTrn [%s]: [%s]", err.response.status, err.response.data.message);
          }
        });
    }
  });

  const saveTransaction = handleSubmit((trnInput: TrnInput) => {
    console.log(trnInput);
    if (trnId === "new") {
      _axios
        .post<Transaction>(
          "/bff/trns",
          { data: [trnInput] },
          {
            headers: getBearerToken(keycloak?.token),
          }
        )
        .then(() => {
          console.debug("<<post Trn");
          setSubmitted(true);
        })
        .catch((err) => {
          setError(err);
          if (err.response) {
            console.error("axios error [%s]: [%s]", err.response.status, err.response.data.message);
          }
        });
    } else {
      _axios
        .patch<Transaction>(`/bff/trns/${portfolioId}/${trnId}`, trnInput, {
          headers: getBearerToken(keycloak?.token),
        })
        .then(() => {
          console.debug("<<patch Trn");
          setSubmitted(true);
        })
        .catch((err) => {
          setError(err);
          if (err.response) {
            console.error("patchedTrn [%s]: [%s]", err.response.status, err.response.data.message);
          }
        });
    }
  });

  if (submitted) {
    history.goBack();
  }

  if (stateError) {
    return <ShowError {...stateError} />;
  }

  if (trnResult.error) {
    return ErrorPage(trnResult.error.stack, trnResult.error.message);
  }

  if (isDone(trnResult) && isDone(currencyResult)) {
    const currencies = currencyResult.data;
    return (
      <div>
        {title()}
        <section className="is-primary">
          <div className="container">
            <div className="columns is-centered is-3">
              <form
                onSubmit={saveTransaction}
                onAbort={handleCancel}
                className="column is-5-tablet is-4-desktop is-3-widescreen"
              >
                <div className="field is-grouped">
                  <div className="control ">
                    <label className="label ">Type</label>
                    <input
                      {...register("trnType")}
                      type="label"
                      className="input is-4"
                      placeholder="Transaction type"
                      name="trnType"
                      defaultValue={trnResult.data.trnType}
                    />
                  </div>
                  <div className="field">
                    <label className="label">Trade Date</label>
                    <div className="control">
                      <input
                        {...register("tradeDate")}
                        className="input is-4"
                        type="text"
                        placeholder="Date of trade"
                        defaultValue={trnResult.data.tradeDate}
                        name="tradeDate"
                      />
                    </div>
                  </div>
                </div>
                <div className="field is-grouped">
                  <div className="field">
                    <label className="label">Quantity</label>
                    <div className="control">
                      <input
                        {...register("quantity")}
                        className="input"
                        type="text"
                        placeholder="Quantity of the asset purchased"
                        defaultValue={trnResult.data.quantity}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Price</label>
                    <div className="control">
                      <input
                        {...register("price")}
                        className="input"
                        type="text"
                        placeholder="Price paid for the asset"
                        defaultValue={trnResult.data.price}
                        name="price"
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Ccy</label>
                    <div className="control">
                      <select
                        {...register("tradeCurrency")}
                        placeholder={"Select Currency of Trade"}
                        className={"select"}
                        name={"tradeCurrency"}
                        defaultValue={trnResult.data.tradeCurrency.code}
                      >
                        {currencyOptions(currencies, trnResult.data.tradeCurrency.code)}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="field is-grouped">
                  <div className="field">
                    <div className="control">
                      <label className="label">Fees</label>
                      <input
                        {...register("fees")}
                        className="input"
                        type="text"
                        placeholder="Fees and charges"
                        defaultValue={trnResult.data.fees}
                        name="fees"
                      />
                    </div>
                  </div>
                  <div className="field">
                    <div className="control">
                      <label className="label">Tax</label>
                      <input
                        {...register("tax")}
                        className="input"
                        type="text"
                        placeholder="Tax Paid"
                        defaultValue={trnResult.data.tax}
                        name="tax"
                      />
                    </div>
                  </div>
                </div>
                <div className="field is-grouped">
                  <div className="field">
                    <label className="label">Trade Base</label>
                    <div className="control">
                      <input
                        {...register("tradeBaseRate")}
                        className="input"
                        type="text"
                        placeholder="Trade to Base Rate"
                        defaultValue={trnResult.data.tradeBaseRate}
                        name="tradeBaseRate"
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Trade Portfolio</label>
                    <div className="control">
                      <input
                        {...register("tradePortfolioRate")}
                        className="input"
                        type="text"
                        placeholder="Trade to Portfolio FX rate"
                        defaultValue={trnResult.data.tradePortfolioRate}
                        name="tradePortfolioRate"
                      />
                    </div>
                  </div>
                </div>
                <div className="field">
                  <div className="control">
                    <label className="label">Amount</label>
                    <input
                      {...register("tradeAmount")}
                      className="input"
                      type="text"
                      placeholder="Amount in Trade Currency"
                      defaultValue={trnResult.data.tradeAmount}
                      name="tradeAmount"
                    />
                  </div>
                </div>
                <div className="field is-grouped">
                  <div className="control">
                    <label className="label">Cash Currency</label>
                    <select
                      {...register("cashCurrency")}
                      placeholder={"Select currency"}
                      className={"select"}
                      name="cashCurrency"
                      defaultValue={trnResult.data.cashCurrency.code}
                    >
                      {currencyOptions(currencies, trnResult.data.cashCurrency.code)}
                    </select>
                  </div>
                  <div className="field">
                    <div className="control">
                      <label className="label">Trade Cash</label>
                      <input
                        {...register("tradeCashRate")}
                        className="input"
                        type="text"
                        placeholder="Trade to Cash FX rate"
                        defaultValue={trnResult.data.tradeCashRate}
                        name="tradeCashRate"
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="label">Cash Amount</label>
                    <div className="control">
                      <input
                        {...register("cashAmount")}
                        className="input"
                        type="text"
                        placeholder="+/- Impact on Cash in Settlement Currency"
                        defaultValue={trnResult.data.cashAmount}
                        name="cashAmount"
                      />
                    </div>
                  </div>
                </div>

                <div className="field is-grouped">
                  <div className="control">
                    <button className="button is-link" onClick={saveTransaction}>
                      Save
                    </button>
                  </div>
                  <div className="control">
                    <button className="button is-link is-light" onClick={handleCancel}>
                      Cancel
                    </button>
                  </div>
                  <div className="control">
                    <button className="button is-link is-danger" onClick={deleteTransaction}>
                      Delete
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </section>
      </div>
    );
  }
  return <div id="root">Loading...</div>;
}
