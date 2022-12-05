import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { Currency } from "@/types/beancounter";
import handleResponse, {fetchError} from "@/core/api/response-writer";
import { getDataUrl } from "@/core/api/bc-config";

const baseUrl = getDataUrl("/currencies");

export default withApiAuthRequired(async function currencies(req, res) {
  console.log(`requesting currencies from ${baseUrl}`);
  try {
    const { accessToken } = await getAccessToken(req, res);

    const response = await fetch(`${baseUrl}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    await handleResponse<Currency[]>(response, res);
  } catch (error: any) {
    fetchError(res, req, error);
  }
});
