import { TransactionUpload } from "@components/types/app";
import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { Kafka, Partitioners, RecordMetadata } from "kafkajs";
import {
  getKafkaClient,
  getKafkaHosts,
  getTrnTopic,
} from "@utils/api/bc-config";
import { NextApiRequest, NextApiResponse } from "next";

export default withApiAuthRequired(async function writeRows(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  await getAccessToken(req, res);
  await writeTrn({ portfolio: req.body.portfolio, row: req.body.row }).catch(
    console.error,
  );
  res.status(200).json("ok");
});

const topic = getTrnTopic();
const brokers = getKafkaHosts();
const clientId = getKafkaClient();

async function writeTrn(
  transactionUpload: TransactionUpload,
): Promise<RecordMetadata[] | void> {
  console.log(`brokers: ${brokers}, clientId: ${clientId}, topic: ${topic}`);
  const producer = new Kafka({
    clientId,
    brokers,
  }).producer({
    allowAutoTopicCreation: true,
    createPartitioner: Partitioners.LegacyPartitioner,
  });
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
