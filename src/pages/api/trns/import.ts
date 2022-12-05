import { TransactionUpload } from "@/types/app";
import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { Kafka, RecordMetadata } from "kafkajs";
import { getKafkaClient, getKafkaHosts, getTrnTopic } from "@/core/api/bc-config";

export default withApiAuthRequired(async function writeRows(req, res) {
  await getAccessToken(req, res);
  await writeTrn({ portfolio: req.body.portfolio, row: req.body.row }).catch(console.error);
  res.status(200).json("ok");
});

const topic = getTrnTopic();
const brokers = getKafkaHosts();
const clientId = getKafkaClient();

async function writeTrn(transactionUpload: TransactionUpload): Promise<RecordMetadata[] | void> {
  console.log(`brokers: ${brokers}, clientId: ${clientId}, topic: ${topic}`);
  const producer = await new Kafka({
    clientId,
    brokers,
  }).producer({ allowAutoTopicCreation: true });
  await producer.connect();
  const messages = [
    {
      key: `${transactionUpload.portfolio.id}.${transactionUpload.row[5]}`,
      value: JSON.stringify(transactionUpload),
      partition: 0,
    },
  ];
  return producer.send({
    topic,
    messages,
  });
}
