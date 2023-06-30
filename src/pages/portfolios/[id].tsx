import React, { useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import {
  Portfolio,
  PortfolioInput,
  PortfolioRequest,
  PortfolioRequests,
} from "@core/types/beancounter";
import { portfolioInputSchema } from "@domain/portfolio/schema";
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
import {
  currencyOptions,
  toCurrency,
  toCurrencyOption,
} from "@core/components/currency";
import ReactSelect from "react-select";
import { yupResolver } from "@hookform/resolvers/yup";
import { validateInput } from "@core/errors/validator";

export default withPageAuthRequired(function Manage(): React.ReactElement {
  function toPortfolioRequest(portfolio: PortfolioInput): PortfolioRequest {
    return {
      code: portfolio.code,
      name: portfolio.name,
      currency: portfolio.currency.value,
      base: portfolio.base.value,
    };
  }

  function toPortfolioRequests(portfolio: PortfolioInput): PortfolioRequests {
    return {
      data: [toPortfolioRequest(portfolio)],
    };
  }

  const handleSubmit: SubmitHandler<PortfolioInput> = (portfolioInput) => {
    validateInput(portfolioInputSchema, portfolioInput)
      .then(() => {
        // This all looks a bit messy but too many other priorities to fix right now.
        // PATCH can only update a single resource
        // POST will create a collection of portfolios.
        const post = router.query.id === "__NEW__";
        fetch(key, {
          method: post ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: post
            ? JSON.stringify(toPortfolioRequests(portfolioInput))
            : JSON.stringify(toPortfolioRequest(portfolioInput)),
        })
          .catch((err) => {
            throw err;
          })
          .then((response) => response.json())
          .then((data) => {
            const route = post
              ? `/portfolios/${data.data[0].id}`
              : `/portfolios/${data.data.id}`;
            router.push(route).then(() => {});
          });
      })
      .catch((e) => {
        console.error(`Some error ${e.message}`);
      });
  };

  const router = useRouter();
  const { t, ready } = useTranslation("common");
  const [purgeTrn, setPurgeTrn] = useState(false);
  const {
    formState: { errors },
    control,
    register,
    getValues,
  } = useForm<PortfolioInput>({
    resolver: yupResolver(portfolioInputSchema),
    mode: "onChange",
  });
  const key = portfolioKey(`${router.query.id}`);
  const { data, error } = useSwr(key, simpleFetcher(key));
  const ccyResponse = useSwr(ccyKey, simpleFetcher(ccyKey));
  if (ccyResponse.error) {
    return errorOut(t("portfolio.error.retrieve"), ccyResponse.error);
  }
  if (error) {
    return errorOut(t("portfolio.error.retrieve"), error);
  }
  if (!ready || !data || ccyResponse.isLoading) {
    return rootLoader(t("loading"));
  }
  const portfolio: Portfolio = data.data;
  const ccyOptions = currencyOptions(ccyResponse.data.data);
  const currencies = ccyResponse.data.data;
  return (
    <div className="container columns is-mobile is-centered">
      <form className="column is-5-tablet is-4-desktop is-3-widescreen">
        <label className="label ">{t("portfolio.code")}</label>
        <input
          {...register("code")}
          type="text"
          className={"input is-3"}
          autoFocus={true}
          placeholder={t("portfolio.code.hint")!!}
          defaultValue={portfolio.code}
        />
        <div className="alert">{errors?.code?.message}</div>
        <label className="label">{t("portfolio.name")}</label>
        <input
          {...register("name", { required: true, maxLength: 100 })}
          className="control input is-3"
          type="text"
          placeholder={t("portfolio.name.hint")!!}
          defaultValue={portfolio.name}
        />
        <div className="alert">{errors?.name?.message}</div>
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
        <div>
          <p></p>
        </div>
        <div className="field is-grouped has-padding-5 has-margin-top-5">
          <button
            type="submit"
            value="submit"
            className="button is-link control"
            onClick={(e) => {
              e.preventDefault();
              handleSubmit(getValues() as PortfolioInput);
            }}
          >
            {t("form.submit")}
          </button>
          <button
            className="control button is-link is-light"
            onClick={(e) => {
              e.preventDefault(); // We want router to handle this
              router.push("/portfolios").then();
            }}
          >
            {t("form.cancel")}
          </button>
          <button className="button is-link is-light control">
            <Link href={`/holdings/${portfolio.code}`}>
              {t("form.holdings")}
            </Link>
          </button>
        </div>
      </form>
      <div>
        <div>{transactionUpload(portfolio)}</div>
      </div>
    </div>
  );

  function transactionUpload(portfolio: Portfolio): React.ReactElement {
    if (!portfolio.id) {
      return <></>;
    }
    return (
      <>
        <div className="field has-margin-top-100">
          <TrnDropZone portfolio={portfolio} purge={purgeTrn} />
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
      </>
    );
  }
});

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});
