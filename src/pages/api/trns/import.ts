import { TransactionUpload } from "@/types/app";
import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { Kafka, RecordMetadata } from "kafkajs";
import { getKafkaHosts, getTrnTopic } from "@/core/api/bc-config";

export default withApiAuthRequired(async function writeRows(req, res) {
  await getAccessToken(req, res);
  await writeTrn({ portfolio: req.body.portfolio, row: req.body.row }).catch(console.error);
  res.status(200).json("ok");
});

const kafka = new Kafka({
  clientId: "bc-view",
  brokers: getKafkaHosts(),
});

const topic = getTrnTopic();

async function writeTrn(transactionUpload: TransactionUpload): Promise<RecordMetadata[] | void> {
  console.log(`${getKafkaHosts()} : ${getTrnTopic()}`);
  const producer = await kafka.producer();
  await producer.connect();
  const messages = [
    {
      key: `${transactionUpload.portfolio.id}.${transactionUpload.row[5]}`,
      value: JSON.stringify(transactionUpload),
    },
  ];
  return producer.send({
    topic,
    messages: messages,
    // acks: 1,
  });
}
