import { TransactionUpload } from "@/types/app";
import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { Kafka, RecordMetadata } from "kafkajs";
import { getKafkaHosts, getTrnTopic } from "@/core/api/bc-config";

export default withApiAuthRequired(async function writeRows(req, res) {
  console.log ("Looking to write..")
  await getAccessToken(req, res);
  await writeTrn({ portfolio: req.body.portfolio, row: req.body.row }).catch(console.error);
  res.status(200).json("ok");
});

const topic = getTrnTopic();

async function writeTrn(transactionUpload: TransactionUpload): Promise<RecordMetadata[] | void> {
  const brokers = getKafkaHosts
  console.log(`${brokers}`)
  const producer = await new Kafka({
    clientId: "bc-view",
    brokers,
  }).producer();
  await producer.connect();
  const messages = [
    {
      key: `${transactionUpload.portfolio.id}.${transactionUpload.row[5]}`,
      value: JSON.stringify(transactionUpload),
    },
  ];
  return producer.send({
    topic,
    messages,
    // acks: 1,
  });
}
