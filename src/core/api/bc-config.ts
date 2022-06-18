export function getDataUrl(path: string) {
  return `${process.env.BC_DATA}/api${path}`;
}

export function getPositionsUrl(path: string) {
  return `${process.env.BC_POSITION}/api${path}`;
}

export function getTrnTopic(): string {
  return `${process.env.KAFKA_TOPIC_TRN}`;
}

export function getKafkaHosts(): string[] {
  console.log("Hello world")
  console.log(`${process.env.KAFKA_URL}`)
  return [`${process.env.KAFKA_URL}`];
}
