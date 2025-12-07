import { TransactionUpload } from "types/app"
import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { NextApiRequest, NextApiResponse } from "next"
import { getBroker, getBrokerConfig, SendResult } from "@lib/broker"

export default withApiAuthRequired(async function writeRows(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await getAccessToken(req, res)

  try {
    const result = await writeTrn({
      portfolio: req.body.portfolio,
      row: req.body.row,
    })

    if (!result.success) {
      console.error("Broker send failed:", result.error)
      res.status(500).json({ error: result.error?.message || "Failed to send message" })
      return
    }

    res.status(200).json("ok")
  } catch (error) {
    console.error("Transaction import error:", error)
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to send message",
    })
  }
})

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
