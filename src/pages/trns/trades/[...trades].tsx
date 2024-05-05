import React from "react";
import { NumericFormat } from "react-number-format";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client";
import { useRouter } from "next/router";
import { assetKey, simpleFetcher, tradeKey } from "@utils/api/fetchHelper";
import { useTranslation } from "next-i18next";
import Link from "next/link";
import { Transaction } from "@components/types/beancounter";
import { rootLoader } from "@components/PageLoader";
import errorOut from "@components/errors/ErrorOut";
import useSwr from "swr";
import { deleteTrn } from "@utils/trns/apiHelper";

export default withPageAuthRequired(function Events(): React.ReactElement {
  const { t } = useTranslation("common");

  const router = useRouter();
  const portfolioId = router.query.trades
    ? router.query.trades[0]
    : "undefined";
  const assetId = router.query.trades ? router.query.trades[1] : "undefined";
  const asset = useSwr(assetKey(assetId), simpleFetcher(assetKey(assetId)));
  const trades = useSwr(
    tradeKey(portfolioId, assetId),
    simpleFetcher(tradeKey(portfolioId, assetId))
  );
  if (trades.error) {
    return errorOut(t("trades.error.retrieve"), trades.error);
  }
  if (asset.error) {
    return errorOut(t("assets.error.retrieve"), asset.error);
  }
  if (asset.isLoading || trades.isLoading) {
    return rootLoader(t("loading"));
  }
  const trnResults = trades.data.data;
  if (!trnResults || trnResults.length === 0) {
    return <div id="root">{t("trn.noTransactions")}</div>;
  }
  return (
    <div>
      <nav className="container">
        <div className={"page-title"}>
          <div className={"column page-title subtitle is-6"}>
            {asset.data.data.name}:{asset.data.data.market.code}
          </div>
        </div>
      </nav>
      <div className="page-box is-primary has-background-light">
        <div className="container">
          <table className={"table is-striped is-hoverable"}>
            <thead>
              <tr>
                <th>{t("trn.type")}</th>
                <th>{t("trn.currency")}</th>
                <th>{t("trn.tradeDate")}</th>
                <th align={"right"}>{t("quantity")}</th>
                <th align={"right"}>{t("trn.price")}</th>
                <th align={"right"}>{t("trn.amount.trade")}</th>
                <th align={"right"}>{t("trn.rate.tb")}</th>
                <th align={"right"}>{t("trn.rate.tc")}</th>
                <th align={"right"}>{t("trn.rate.tp")}</th>
                <th align={"right"}>{t("trn.amount.cash")}</th>
                <th align={"right"}>{t("trn.amount.tax")}</th>
                <th align={"right"}>{t("trn.amount.charges")}</th>
                <th align={"right"}>{t("trn.action")}</th>
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
                      decimalScale={4}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.tradeCashRate}
                      displayType={"text"}
                      decimalScale={4}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.tradePortfolioRate}
                      displayType={"text"}
                      decimalScale={4}
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
                  <td align={"left"}>
                    <Link
                      href={`/trns/trades/edit/${trn.portfolio.id}/${trn.id}`}
                      className="fa fa-edit"
                    ></Link>
                    <text
                      onClick={() => deleteTrn(trn.id, t("trn.delete"))}
                      className="simple-padding fa fa-trash-can"
                    ></text>
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
