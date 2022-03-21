import { TransactionUpload } from "@/types/app";
import { withApiAuthRequired, getAccessToken } from "@auth0/nextjs-auth0";
import { Kafka } from "kafkajs";
import { getKafkaHosts, getTrnTopic } from "@/core/api/bc-config";

export default withApiAuthRequired(async function writeRows(req, res) {
  await getAccessToken(req, res);
  writeTrn({ portfolio: req.body.portfolio, row: req.body.row });
});

const kafka = new Kafka({
  clientId: "bc-view",
  brokers: getKafkaHosts,
});

function writeTrn(transactionUpload: TransactionUpload): void {
  try {
    const producer = kafka.producer();
    const messages = [
      {
        key: `${transactionUpload.portfolio.id}/${transactionUpload.row[5]}`,
        value: JSON.stringify(transactionUpload),
      },
    ];
    producer.connect().then();
    producer.send({ topic: getTrnTopic(), messages: messages }).then();
  } catch (e: any) {
    console.error("%s", e.toString());
  }
}
