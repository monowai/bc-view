import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { PortfolioInput } from "@core/types/beancounter";
import { currencyOptions } from "@domain/currency/IsoHelper";
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
import {useUser} from "@auth0/nextjs-auth0/dist/client";

export default withPageAuthRequired(function Manage(): React.ReactElement {
  const { register } = useForm<PortfolioInput>();
  const router = useRouter();
  const key = portfolioKey(`${router.query.id}`);
  const { data, error } = useSwr(key, simpleFetcher(key));
  const [purgeTrn, setPurgeTrn] = useState(false);
  const ccyResponse = useSwr(ccyKey, simpleFetcher(ccyKey));
  const { t, ready } = useTranslation("common");

  if (ccyResponse.error) {
    return errorOut(t("events.error.retrieve"), ccyResponse.error);
  }

  if (error) {
    return errorOut(t("events.error.retrieve"), error);
  }
  if (!ready || !data || !ccyResponse.data) {
    return rootLoader(t("loading"));
  }
  const portfolio = data.data;
  const currencies = ccyResponse.data.data;

  return (
    <div>
      <section className="is-primary is-fullheight">
        <div className="container">
          <div className="columns is-centered">
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
                <label className="label">
                  {t("portfolio.currency.reporting")}
                </label>
                <div className="control">
                  <select
                    placeholder={"Select currency"}
                    className={"select is-3"}
                    defaultValue={portfolio.currency.code}
                    {...register("currency", { required: true })}
                  >
                    {currencyOptions(currencies, portfolio.currency.code)}
                  </select>
                </div>
              </div>
              <div className="field">
                <label className="label">
                  {t("portfolio.currency.base.label")}
                </label>
                <div className="control">
                  <select
                    placeholder={"Select currency"}
                    className={"select is-3"}
                    defaultValue={portfolio.base.code}
                    {...register("base", { required: true })}
                  >
                    {currencyOptions(currencies, portfolio.base.code)}
                  </select>
                </div>
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
                <TrnDropZone portfolio={portfolio} purge={purgeTrn}/>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
});

// noinspection JSUnusedGlobalSymbols
export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});
