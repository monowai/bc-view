import getConfig from "next/config";

const { publicRuntimeConfig } = getConfig();
export function getDataUrl(path: string) {
  return `${publicRuntimeConfig.apiDataUrl}${path}`;
}

export function getPositionsUrl(path: string) {
  return `${publicRuntimeConfig.apiPositionsUrl}${path}`;
}

export function getTrnTopic(): string {
  return `${publicRuntimeConfig.topicTrn}`;
}

export function getKafkaHosts(): string[] {
  return [`${publicRuntimeConfig.kafkaUrl}`];
}
