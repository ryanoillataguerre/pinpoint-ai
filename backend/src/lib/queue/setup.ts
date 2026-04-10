import { rabbitmq } from "./connection";
import { EXCHANGES, QUEUE_CONFIGS } from "./queues";

export async function setupQueues(): Promise<void> {
  await rabbitmq.connect();
  const channel = await rabbitmq.getPublishChannel();

  // Assert exchanges
  await channel.assertExchange(EXCHANGES.PIPELINE, "direct", { durable: true });
  await channel.assertExchange(EXCHANGES.PIPELINE_DLX, "direct", { durable: true });

  // Assert queues and bind them
  for (const config of Object.values(QUEUE_CONFIGS)) {
    // Dead letter queue
    await channel.assertQueue(config.dlq, {
      durable: true,
    });
    await channel.bindQueue(config.dlq, EXCHANGES.PIPELINE_DLX, config.routingKey);

    // Main queue with DLX (and optional priority support)
    await channel.assertQueue(config.queue, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": EXCHANGES.PIPELINE_DLX,
        "x-dead-letter-routing-key": config.routingKey,
        ...(config.maxPriority ? { "x-max-priority": config.maxPriority } : {}),
      },
    });
    await channel.bindQueue(config.queue, EXCHANGES.PIPELINE, config.routingKey);
  }

  console.log("RabbitMQ queues set up");
}
