import { handleAuth, handleLogin } from "@auth0/nextjs-auth0";
import { fetchError } from "@/core/api/response-writer";

/* eslint max-len: ["error", { "ignoreComments": true }] */
/*
 https://community.auth0.com/t/accesstokenerror-could-not-retrieve-an-access-token-with-scopes-openid-profile-email/61745/20
 */
export default handleAuth({
  async login(req, res) {
    try {
      await handleLogin(req, res, {
        authorizationParams: {
          // or AUTH0_SCOPE ?
          scope:
            "openid profile email offline_access beancounter beancounter:user",
        },
      });
    } catch (error: any) {
      fetchError(res, req, error);
    }
  },
});
