import { ConsumeMessage } from "amqplib";
import { rabbitmq } from "./connection";
import { QueueConfig } from "./queues";
import { JobMessage } from "./producer";

export type JobHandler<T = unknown> = (data: T, message: JobMessage<T>) => Promise<void>;

export async function registerConsumer<T>(
  config: QueueConfig,
  handler: JobHandler<T>
): Promise<void> {
  const channel = await rabbitmq.getConsumerChannel(config.queue, config.prefetch);

  await channel.consume(
    config.queue,
    async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      let parsed: JobMessage<T>;
      try {
        parsed = JSON.parse(msg.content.toString()) as JobMessage<T>;
      } catch (err) {
        console.error(`Failed to parse message on ${config.queue}:`, err);
        channel.nack(msg, false, false); // send to DLQ
        return;
      }

      parsed.attempts += 1;

      try {
        await handler(parsed.data, parsed);
        channel.ack(msg);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error(
          `Job ${parsed.id} failed (attempt ${parsed.attempts}/${parsed.maxAttempts}):`,
          error.message
        );

        if (parsed.attempts >= parsed.maxAttempts) {
          // Max attempts reached — send to DLQ
          console.warn(`Job ${parsed.id} exhausted retries, sending to DLQ`);
          channel.nack(msg, false, false);
        } else {
          // Re-enqueue with delay via re-publish
          // nack without requeue (goes to DLQ), then re-publish with incremented attempts
          channel.nack(msg, false, false);

          // Re-publish to main queue for retry
          const pubChannel = await rabbitmq.getPublishChannel();
          const retryMsg = { ...parsed };
          const delay = Math.min(5000 * Math.pow(2, parsed.attempts - 1), 60000);

          setTimeout(() => {
            pubChannel.publish(
              "ex.pipeline",
              config.routingKey,
              Buffer.from(JSON.stringify(retryMsg)),
              {
                persistent: true,
                contentType: "application/json",
                messageId: retryMsg.id,
              }
            );
            console.log(
              `Retrying job ${retryMsg.id} (attempt ${retryMsg.attempts + 1}) after ${delay}ms`
            );
          }, delay);
        }
      }
    },
    { noAck: false }
  );

  console.log(`Consumer registered for ${config.queue} (prefetch: ${config.prefetch})`);
}
