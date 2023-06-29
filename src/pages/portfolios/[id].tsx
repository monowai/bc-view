import React, { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import {
  Currency,
  CurrencyOption,
  Portfolio,
  PortfolioInput,
} from "@core/types/beancounter";
import { ccyKey, portfolioKey, simpleFetcher } from "@core/api/fetchHelper";
import { useRouter } from "next/router";
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { GetServerSideProps } from "next";
import { TrnDropZone } from "@domain/trns/DropZone";
import Link from "next/link";
import { rootLoader } from "@core/common/PageLoader";
import errorOut from "@core/errors/ErrorOut";
import useSwr from "swr";
import { currencyOptions, toCurrency } from "@core/components/Currency";
import ReactSelect from "react-select";

function toCurrencyOption(currency: Currency): CurrencyOption {
  return { value: currency.code, label: currency.code };
}

export default withPageAuthRequired(function Manage(): React.ReactElement {
  const onSubmit: SubmitHandler<PortfolioInput> = (portfolioInput) =>
    console.log(
      `${portfolioInput.currency.value} / ${portfolioInput.base.value}`
    );

  const router = useRouter();
  const { t, ready } = useTranslation("common");
  const [purgeTrn, setPurgeTrn] = useState(false);
  const { control, register, getValues } = useForm<PortfolioInput>();
  const key = portfolioKey(`${router.query.id}`);
  const { data, error } = useSwr(key, simpleFetcher(key));
  const ccyResponse = useSwr(ccyKey, simpleFetcher(ccyKey));

  if (!ready || !data || !ccyResponse.data) {
    return rootLoader(t("loading"));
  }
  if (ccyResponse.error) {
    return errorOut(t("events.error.retrieve"), ccyResponse.error);
  }
  const portfolio: Portfolio = data.data;
  if (error && !portfolio) {
    return errorOut(t("events.error.retrieve"), error);
  }
  const ccyOptions = currencyOptions(ccyResponse.data.data);
  const currencies = ccyResponse.data.data;
  return (
    <div className="container">
      <div className="columns is-mobile is-centered">
        <form className="column is-5-tablet is-4-desktop is-3-widescreen">
          <label className="label ">{t("portfolio.code")}</label>
          <input
            {...register("code", { required: true })}
            type="text"
            className={"input"}
            autoFocus={true}
            placeholder={t("portfolio.code.hint")!!}
            value={portfolio.code}
          />
          <label className="label">{t("portfolio.name")}</label>
          <div className="control">
            <input
              {...register("name", { required: true, maxLength: 100 })}
              className="input is-3"
              type="text"
              placeholder={t("portfolio.name.hint")!!}
              defaultValue={portfolio.name}
            />
          </div>
          <label className="label">{t("portfolio.currency.reporting")}</label>
          <Controller
            name="currency"
            control={control}
            defaultValue={toCurrencyOption(portfolio.currency)}
            rules={{ required: true }}
            render={({ field }) => (
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

          <label className="label">{t("portfolio.currency.base.label")}</label>
          <Controller
            name="base"
            control={control}
            rules={{ required: true }}
            defaultValue={toCurrencyOption(portfolio.base)}
            render={({ field }) => (
              <ReactSelect
                {...field}
                defaultValue={toCurrencyOption(portfolio.base)}
                options={ccyOptions}
                onChange={(event) => {
                  field.onChange(toCurrency(event!!.value, currencies));
                }}
              />
            )}
          />
          <div className="field is-grouped">
            <div className="control">
              {/*<input type="submit" />*/}
              <button
                type="submit"
                value="submit"
                className="button is-link"
                onClick={(e) => {
                  e.preventDefault();
                  onSubmit(getValues() as PortfolioInput);
                }}
              >
                {t("form.submit")}
              </button>
            </div>
            <div className="control">
              <button
                className="button is-link is-light"
                onClick={(e) => {
                  e.preventDefault(); // We want router to handle this
                  router.back();
                }}
              >
                {t("form.cancel")}
              </button>
            </div>
            <div className="control">
              <button className="button is-link is-light">
                <Link href={`/holdings/${portfolio.code}`}>
                  {t("form.holdings")}
                </Link>
              </button>
            </div>
          </div>
          <div>{transactionUpload()}</div>
        </form>
      </div>
    </div>
  );

  function transactionUpload(): React.ReactElement {
    return (
      <>
        <div className="field">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={purgeTrn}
              onChange={() => setPurgeTrn(!purgeTrn)}
            />
            &nbsp;{t("portfolio.delete.trns")}
          </label>
        </div>
        <div className="field">
          <TrnDropZone portfolio={portfolio} purge={purgeTrn} />
        </div>
      </>
    );
  }
});

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});
