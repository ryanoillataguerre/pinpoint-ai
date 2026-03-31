import { v4 as uuidv4 } from "uuid";
import { rabbitmq } from "./connection";
import { EXCHANGES, ROUTING_KEYS } from "./queues";

export interface JobMessage<T = unknown> {
  id: string;
  type: string;
  data: T;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
}

function createMessage<T>(type: string, data: T, maxAttempts = 3): JobMessage<T> {
  return {
    id: uuidv4(),
    type,
    data,
    attempts: 0,
    maxAttempts,
    createdAt: Date.now(),
  };
}

async function publish(routingKey: string, message: JobMessage): Promise<void> {
  const channel = await rabbitmq.getPublishChannel();
  channel.publish(
    EXCHANGES.PIPELINE,
    routingKey,
    Buffer.from(JSON.stringify(message)),
    {
      persistent: true,
      contentType: "application/json",
      messageId: message.id,
    }
  );
}

// ─── Job type payloads ─────────────────────────────────────

export interface ExtractionJobData {
  sheetId: string;
}

export interface NormalizationJobData {
  sheetId: string;
  itemIds: string[];
}

export interface MatchingJobData {
  sheetId: string;
  itemId: string;
}

export interface PricingJobData {
  matchedProductId: string;
  asin: string;
  sheetId: string;
}

// ─── Publishers ────────────────────────────────────────────

export async function enqueueExtraction(data: ExtractionJobData): Promise<string> {
  const msg = createMessage("extraction", data);
  await publish(ROUTING_KEYS.EXTRACTION, msg);
  console.log(`Enqueued extraction job ${msg.id} for sheet ${data.sheetId}`);
  return msg.id;
}

export async function enqueueNormalization(data: NormalizationJobData): Promise<string> {
  const msg = createMessage("normalization", data);
  await publish(ROUTING_KEYS.NORMALIZATION, msg);
  return msg.id;
}

export async function enqueueMatching(data: MatchingJobData): Promise<string> {
  const msg = createMessage("matching", data);
  await publish(ROUTING_KEYS.MATCHING, msg);
  return msg.id;
}

export async function enqueuePricing(data: PricingJobData): Promise<string> {
  const msg = createMessage("pricing", data);
  await publish(ROUTING_KEYS.PRICING, msg);
  return msg.id;
}

export async function enqueueMatchingBatch(
  sheetId: string,
  itemIds: string[]
): Promise<void> {
  const channel = await rabbitmq.getPublishChannel();
  for (const itemId of itemIds) {
    const msg = createMessage("matching", { sheetId, itemId });
    channel.publish(
      EXCHANGES.PIPELINE,
      ROUTING_KEYS.MATCHING,
      Buffer.from(JSON.stringify(msg)),
      {
        persistent: true,
        contentType: "application/json",
        messageId: msg.id,
      }
    );
  }
  console.log(`Enqueued ${itemIds.length} matching jobs for sheet ${sheetId}`);
}
