import React, { ReactElement } from "react";
import "@styles/bc.sass";
import type { AppProps } from "next/app";
import { appWithTranslation } from "next-i18next";
import Header from "@pages/header/Header";
import { UserProvider } from "@auth0/nextjs-auth0/client";

function App({ Component, pageProps }: AppProps): ReactElement {
  return (
    <UserProvider>
      <div className={"page.box"}>
        <Header />
        <Component {...pageProps} />
      </div>
    </UserProvider>
  );
}

export default appWithTranslation(App);
