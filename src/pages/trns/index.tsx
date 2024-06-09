import { withPageAuthRequired } from "@auth0/nextjs-auth0/client";
import React from "react";
import { useTranslation } from "next-i18next";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";

export default withPageAuthRequired(function AddTrade(): React.ReactElement {
  const { t } = useTranslation("common");
  // const tradeState = useTradeState();
  // const { register } = useForm<TradeDefaults>();

  // On/Off market
  // On ->
  //    Market, Asset, details, (category)
  // Off ->
  //    Generic Cash
  //        Deposit/Withdrawal/Balance
  //    Real Estate / Art
  //        Add/Reduce
  //
  return (
    <section className="section">
      <h1 className="title">{t("trade.title")}</h1>
    </section>
  );
});

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});
