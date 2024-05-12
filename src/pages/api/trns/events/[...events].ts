import { withApiAuthRequired, getAccessToken } from "@auth0/nextjs-auth0";
import { requestInit } from "@utils/api/fetchHelper";
import handleResponse, { fetchError } from "@utils/api/response-writer";
import { Transaction } from "@components/types/beancounter";
import { baseUrl } from "@pages/api/trns";
import {NextApiRequest, NextApiResponse} from "next";
export default withApiAuthRequired(async function eventTrns(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { events } = req.query;
    const { accessToken } = await getAccessToken(req, res);
    if (events) {
      console.log(`Looking up events for ${events[0]} / ${events[1]}`);
      const response = await fetch(
        `${baseUrl}/${events[0]}/asset/${events[1]}/events`,
        requestInit(accessToken),
      );
      await handleResponse<Transaction[]>(response, res);
    }
  } catch (error: any) {
    fetchError(res, req, error);
  }
});
