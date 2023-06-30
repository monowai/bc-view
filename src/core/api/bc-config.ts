export function getDataUrl(path: string = ""): string {
  return `${process.env.BC_DATA}${path}`;
}

export function getPositionsUrl(path: string): string {
  return `${process.env.BC_POSITION}${path}`;
}

export function getTrnTopic(): string {
  return `${process.env.KAFKA_TOPIC_TRN}`;
}

export function getKafkaHosts(): string[] {
  return [`${process.env.KAFKA_URL}`];
}

export function getKafkaClient(): string {
  return `${process.env.KAFKA_CLIENT}`;
}
