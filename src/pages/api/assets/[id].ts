import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { Asset } from "@/types/beancounter";
import handleResponse, {fetchError} from "@/core/api/response-writer";
import { getDataUrl } from "@/core/api/bc-config";

const baseUrl = getDataUrl("/assets");

export default withApiAuthRequired(async function asset(req, res) {
  console.log(`requesting Asset from ${baseUrl}`);
  try {
    const {
      query: { id },
    } = req;

    const { accessToken } = await getAccessToken(req, res);

    const response = await fetch(`${baseUrl}/${id}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    await handleResponse<Asset>(response, res);
  } catch (error: any) {
    fetchError(res, req, error);
  }
});
