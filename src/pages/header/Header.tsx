import React from "react";
import HeaderBrand from "@/pages/header/HeaderBrand";
import HeaderUserControls from "@/pages/header/HeaderUserControls";
import { t } from "i18next";
import {GetServerSideProps} from "next";
import {serverSideTranslations} from "next-i18next/serverSideTranslations";

export default function Header(): React.ReactElement {
  return (
    <header>
      <nav className="navbar">
        <HeaderBrand />
        <div className="navbar-menu">
          <div className="navbar-start">
            <div className="navbar-item">
              <small>{t("tagline")}&nbsp;&nbsp;</small>
              <i className="fas fa-euro-sign"> </i>
              <i className="fas fa-dollar-sign"> </i>
              <i className="fas fa-pound-sign"> </i>
            </div>
          </div>
          <HeaderUserControls />
        </div>
      </nav>
    </header>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});

