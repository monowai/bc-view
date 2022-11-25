import React from "react";
import {NumericFormat} from "react-number-format";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { withPageAuthRequired } from "@auth0/nextjs-auth0";
import { useRouter } from "next/router";
import useApiFetchHelper, { getOptions } from "@/core/api/use-api-fetch-helper";
import { useTranslation } from "next-i18next";
import Link from "next/link";
import { Transaction } from "@/types/beancounter";

export default withPageAuthRequired(function Events(): React.ReactElement {
  const router = useRouter();
  const portfolioId = router.query.trades ? router.query.trades[0] : "undefined";
  const assetId = router.query.trades ? router.query.trades[1] : "undefined";
  const { t, ready } = useTranslation("common");
  const assetResponse = useApiFetchHelper(`/api/assets/${assetId}`, getOptions);
  const { response, error, isLoading } = useApiFetchHelper(
    `/api/trns/trades/${portfolioId}/${assetId}`,
    getOptions
  );
  if (!ready || isLoading || assetResponse.isLoading) {
    return <div id="root">...</div>;
  }
  if (error) {
    return (
      <>
        <p>{t("events.error.retrieve", { id: router.query.id })}</p>
        <pre style={{ color: "red" }}>{JSON.stringify(error, null, 2)}</pre>
      </>
    );
  }
  const trnResults = response.data;
  if (!trnResults || trnResults.length === 0) {
    return <div id="root">{t("trn.noTransactions")}</div>;
  }

  return (
    <div>
      <nav className="container">
        <div className={"page-title"}>
          <div className={"column page-title subtitle is-6"}>
            {assetResponse.response.data.name}:{assetResponse.response.data.market.code}
          </div>
        </div>
      </nav>
      <div className="page-box is-primary has-background-light">
        <div className="container">
          <table className={"table is-striped is-hoverable"}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Currency</th>
                <th>Trade Date</th>
                <th align={"right"}>Quantity</th>
                <th align={"right"}>Price</th>
                <th align={"right"}>Amount</th>
                <th align={"right"}>T/B Rate</th>
                <th align={"right"}>Cash</th>
                <th align={"right"}>Tax</th>
                <th align={"right"}>Charges</th>
                <th>{t("trn.action")}</th>
              </tr>
            </thead>
            <tbody>
              {trnResults.map((trn: Transaction) => (
                <tr key={trn.id}>
                  <td>{trn.trnType}</td>
                  <td>{trn.tradeCurrency.code}</td>
                  <td>{trn.tradeDate}</td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.quantity}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.price}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.tradeAmount}
                      displayType={"text"}
                      decimalScale={0}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.tradeBaseRate}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.cashAmount}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>

                  <td align={"right"}>
                    <NumericFormat
                      value={trn.tax}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.fees}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td>
                    <Link href={`/portfolios/${trn.portfolio.id}/${trn.id}`}>
                      <a className="fa fa-edit" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
});

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});
