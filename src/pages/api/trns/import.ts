import { TransactionUpload } from "types/app"
import { auth0 } from "@lib/auth0"
import { NextApiRequest, NextApiResponse } from "next"
import { getBroker, getBrokerConfig, SendResult } from "@lib/broker"
import { fetchError } from "@utils/api/responseWriter"

export default async function writeRows(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const session = await auth0.getSession(req)
  if (!session) {
    res.status(401).json({ error: "Not authenticated" })
    return
  }

  const { token: accessToken } = await auth0.getAccessToken(req, res)

  try {
    const result = await writeTrn({
      portfolio: req.body.portfolio,
      row: req.body.row,
      token: accessToken,
    })

    if (!result.success) {
      console.error("Broker send failed:", result.error)
      res
        .status(500)
        .json({ error: result.error?.message || "Failed to send message" })
      return
    }

    res.status(200).json("ok")
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
}

function writeTrn(transactionUpload: TransactionUpload): Promise<SendResult> {
  const config = getBrokerConfig()
  const broker = getBroker()

  const messageKey = `${transactionUpload.portfolio.id}.${transactionUpload.row[5]}`

  return broker.send({
    key: messageKey,
    value: transactionUpload,
    topic: config.topic,
  })
}
