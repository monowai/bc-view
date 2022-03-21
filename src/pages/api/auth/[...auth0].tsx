import { handleAuth, handleLogin } from "@auth0/nextjs-auth0";

// https://community.auth0.com/t/
// accesstokenerror-could-not-retrieve-an-access-token-with-scopes-openid-profile-email/61745/20
export default handleAuth({
  async login(req, res) {
    try {
      await handleLogin(req, res, {
        authorizationParams: {
          // or AUTH0_SCOPE ?
          scope: "openid profile email offline_access beancounter beancounter:user",
        },
      });
    } catch (error: any) {
      res.status(error.status || 400).end(error.message);
    }
  },
});
