import { withApiAuthRequired } from "@auth0/nextjs-auth0";
import { getDataUrl } from "@core/api/bc-config";
import { fetchError } from "@core/api/response-writer";

export const baseUrl = getDataUrl("/trns");
export default withApiAuthRequired(async function trnsApi(req, res) {
  try {
    console.log("Add Trns");
    await res.status(200).json({ data: {} });
  } catch (error: any) {
    fetchError(res, req, error);
  }
});
