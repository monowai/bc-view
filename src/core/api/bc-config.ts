import getConfig from "next/config";

const { publicRuntimeConfig, serverRuntimeConfig } = getConfig();
export function getDataUrl(path: string) {
  return `${serverRuntimeConfig.apiDataUrl}${path}`;
}

export function getPositionsUrl(path: string) {
  return `${serverRuntimeConfig.apiPositionsUrl}${path}`;
}

export function getTrnTopic(): string {
  return `${publicRuntimeConfig.topicTrn}`;
}

export function getKafkaHosts(): string[] {
  return [`${publicRuntimeConfig.kafkaUrl}`];
}
