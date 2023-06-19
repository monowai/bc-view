import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Portfolio, PortfolioInput } from "@core/types/beancounter";
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
import { currencyOptions, CurrencySelector } from "@core/components/currency";

export default withPageAuthRequired(function Manage(): React.ReactElement {
  const { register } = useForm<PortfolioInput>();
  const router = useRouter();
  const key = portfolioKey(`${router.query.id}`);
  const { data, error } = useSwr(key, simpleFetcher(key));

  const [purgeTrn, setPurgeTrn] = useState(false);

  const ccyResponse = useSwr(ccyKey, simpleFetcher(ccyKey));
  const { t, ready } = useTranslation("common");

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
  const currencies = currencyOptions(ccyResponse.data.data);

  return (
    <div className="container">
      <div className="columns is-mobile is-centered">
        <form className="column is-5-tablet is-4-desktop is-3-widescreen">
          <label className="label ">{t("portfolio.code")}</label>
          <div className="control ">
            <input
              {...register("code", { required: true })}
              type="text"
              className={"input"}
              autoFocus={true}
              placeholder={t("portfolio.code.hint")!!}
              defaultValue={portfolio.code}
            />
          </div>
          <div className="field">
            <label className="label">{t("portfolio.name")}</label>
            <div className="control">
              <input
                className="input is-3"
                type="text"
                placeholder={t("portfolio.name.hint")!!}
                defaultValue={portfolio.name}
                {...register("name", { required: true, maxLength: 100 })}
              />
            </div>
          </div>
          <div className="field">
            <label className="label">{t("portfolio.currency.reporting")}</label>
            <CurrencySelector
              placeHolder={t("portfolio.select.currency")}
              defaultValue={portfolio.currency}
              currencyOptions={currencies}
              xFunc={register("currency", { required: true })}
            />
          </div>
          <div className="field">
            <label className="label">
              {t("portfolio.currency.base.label")}
            </label>
            <CurrencySelector
              placeHolder={t("portfolio.select.currency")}
              defaultValue={portfolio.base}
              currencyOptions={currencies}
              xFunc={register("base", { required: true })}
            />
          </div>
          <div className="field is-grouped">
            <div className="control">
              <button className="button is-link">{t("form.submit")}</button>
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
            <div>
              <div className="control">
                <button className="button is-link is-light">
                  <Link href={`/holdings/${portfolio.code}`}>
                    {t("form.holdings")}
                  </Link>
                </button>
              </div>
            </div>
          </div>
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
        </form>
      </div>
    </div>
  );
});

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});
