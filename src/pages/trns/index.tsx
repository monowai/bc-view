import { withPageAuthRequired } from "@auth0/nextjs-auth0/client";
import React from "react";
import { useTranslation } from "next-i18next";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { Tabs } from "@core/components/tabs/Tabs";

export default withPageAuthRequired(function AddTrade(): React.ReactElement {
  const { t } = useTranslation("common");
  // const tradeState = useTradeState();
  // const { register } = useForm<TradeDefaults>();

  // On/Off market
  // On ->
  //    Market, Asset, details, category
  // Off ->
  //    Generic Cash
  //        Deposit/Withdrawal/Balance
  //    Real Estate / Art
  //        Add/Reduce
  //
  return (
    <section className="section">
      <h1 className="title">Add a Trade</h1>

      <Tabs defaultTabId="onMarket">
        <Tabs.TabList isSize="medium">
          <Tabs.Tab tabId="onMarket">{t("trade.onmarket")}</Tabs.Tab>
          <Tabs.Tab tabId="offMarket">{t("trade.offmarket")}</Tabs.Tab>
        </Tabs.TabList>

        <Tabs.TabPanel tabId="onMarket">{onMarketForm()}</Tabs.TabPanel>
        <Tabs.TabPanel tabId="offMarket">{offMarketForm()}</Tabs.TabPanel>
      </Tabs>
    </section>
  );
});

function onMarketForm(): React.ReactElement {
  return <div className="box">OnMarket</div>;
}

function offMarketForm(): React.ReactElement {
  return <div className="box">OffMarket</div>;
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});
