import { handleAuth, handleLogin, handleLogout } from "@auth0/nextjs-auth0"
import { NextApiRequest, NextApiResponse } from "next"
import { fetchError } from "@lib/api/responseWriter"

/* eslint max-len: ["error", { "ignoreComments": true }] */
/*
 https://community.auth0.com/t/accesstokenerror-could-not-retrieve-an-access-token-with-scopes-openid-profile-email/61745/20
 */
export default handleAuth({
  async login(req: NextApiRequest, res: NextApiResponse) {
    try {
      await handleLogin(req, res, {
        authorizationParams: {
          scope:
            "openid profile email offline_access beancounter beancounter:user",
          // Add additional security parameters
          prompt: "login", // Force re-authentication for sensitive apps
        },
        returnTo: (req.query.returnTo as string) || "/portfolios",
      })
    } catch (error: any) {
      fetchError(res, req, error)
    }
  },
  async logout(req: NextApiRequest, res: NextApiResponse) {
    try {
      await handleLogout(req, res, {
        returnTo: `${process.env.AUTH0_BASE_URL}/`,
      })
    } catch (error: any) {
      fetchError(res, req, error)
    }
  },
})
