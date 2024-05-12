import React from "react";
import type { AppProps } from "next/app";
import { appWithTranslation } from "next-i18next";
import Header from "@pages/header/Header";
import { UserProvider } from "@auth0/nextjs-auth0/client";
import "@styles/bc.sass";

const App: React.FC<AppProps> = ({ Component, pageProps }) => {
  return (
    <UserProvider>
      <div className="page.box">
        <Header />
        <Component {...pageProps} />
      </div>
    </UserProvider>
  );
}

export default appWithTranslation(App);
