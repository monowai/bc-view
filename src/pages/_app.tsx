import React from "react"
import type { AppProps } from "next/app"
import { appWithTranslation } from "next-i18next"
import Header from "@pages/header/Header"
import Modal from "react-modal"
import { UserProvider } from "@auth0/nextjs-auth0/client"
import "@styles/bc.sass"
import GitInfo from "@components/GitInfo"
import { useRouter } from "next/router"

Modal.setAppElement("#root")
const App: React.FC<AppProps> = ({ Component, pageProps }) => {
  const router = useRouter()
  const alwaysVisible =
    router.pathname === "/" || router.pathname === "/portfolios"

  return (
    <UserProvider>
      <div className="page.box">
        <Header />
        <Component {...pageProps} />
      </div>
      <GitInfo alwaysVisible={alwaysVisible} />
    </UserProvider>
  )
}

export default appWithTranslation(App)
