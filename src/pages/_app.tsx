import React from "react"
import type { AppProps } from "next/app"
import { appWithTranslation } from "next-i18next"
import Header from "@components/layout/Header"
import { UserProvider } from "@auth0/nextjs-auth0/client"
//import "@styles/bc.sass"
import "@styles/globals.css"
import "@fortawesome/fontawesome-free/css/all.min.css"
import GitInfo from "@components/ui/GitInfo"
import { useRouter } from "next/router"
import { RegistrationProvider } from "@contexts/RegistrationContext"
import { UserPreferencesProvider } from "@contexts/UserPreferencesContext"

// Inner component that renders the app content
interface AppContentProps {
  Component: AppProps["Component"]
  pageProps: AppProps["pageProps"]
  alwaysVisible: boolean
}

const AppContent: React.FC<AppContentProps> = ({
  Component,
  pageProps,
  alwaysVisible,
}) => {
  return (
    <>
      <div className="pt-2 px-2 pb-2 sm:pt-3 sm:px-3 sm:pb-3 md:px-4 md:pb-4 bg-gray-100">
        <Header />
        <Component {...pageProps} />
      </div>
      <GitInfo alwaysVisible={alwaysVisible} />
    </>
  )
}

const App: React.FC<AppProps> = ({ Component, pageProps }) => {
  const router = useRouter()
  const alwaysVisible =
    router.pathname === "/" || router.pathname === "/portfolios"

  return (
    <UserProvider>
      <RegistrationProvider>
        <UserPreferencesProvider>
          <AppContent
            Component={Component}
            pageProps={pageProps}
            alwaysVisible={alwaysVisible}
          />
        </UserPreferencesProvider>
      </RegistrationProvider>
    </UserProvider>
  )
}

export default appWithTranslation(App)
