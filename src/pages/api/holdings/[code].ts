import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { requestInit } from "@utils/api/fetchHelper";
import handleResponse, { fetchError } from "@utils/api/response-writer";
import { HoldingContract } from "@components/types/beancounter";
import { getPositionsUrl } from "@utils/api/bc-config";

const baseUrl = getPositionsUrl();
export default withApiAuthRequired(async function holdingsByCode(req, res) {
  try {
    const { accessToken } = await getAccessToken(req, res);
    const {
      query: { code },
    } = req;
    console.log(`Looking up holdings ${code}`);
    const response = await fetch(
      `${baseUrl}/${code}/today`,
      requestInit(accessToken)
    );
    await handleResponse<HoldingContract>(response, res);
  } catch (error: any) {
    fetchError(res, req, error);
  }
});
