import { withApiAuthRequired } from "@auth0/nextjs-auth0";
import { getDataUrl } from "@utils/api/bc-config";
import { fetchError } from "@utils/api/response-writer";
import { NextApiRequest, NextApiResponse } from "next";

export const baseUrl = getDataUrl("/trns");
export default withApiAuthRequired(function trnsApi(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    console.log("Add Trns");
    res.status(200).json({ data: {} });
  } catch (error: any) {
    fetchError(res, req, error);
  }
});
