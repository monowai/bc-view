import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { Registration } from "@components/types/beancounter";
import handleResponse, { fetchError } from "@utils/api/response-writer";
import { getDataUrl } from "@utils/api/bc-config";

const baseUrl = getDataUrl();

export default withApiAuthRequired(async function currencies(req, res) {
  console.log(`Registering user @ \`${baseUrl}/register`);
  try {
    const { accessToken } = await getAccessToken(req, res);
    const response = await fetch(`${baseUrl}/register`, {
      method: "POST",
      body: JSON.stringify({ active: true }),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
    });
    await handleResponse<Registration>(response, res);
  } catch (error: any) {
    fetchError(res, req, error);
  }
});
