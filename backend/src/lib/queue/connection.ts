import amqp, { Channel, ChannelModel } from "amqplib";

const RABBITMQ_URL = process.env.RABBITMQ_URL || "amqp://pinpoint:pinpoint@localhost:5674";

class RabbitMQConnection {
  private connection: ChannelModel | null = null;
  private publishChannel: Channel | null = null;
  private consumerChannels: Map<string, Channel> = new Map();

  async connect(): Promise<void> {
    if (this.connection) return;

    this.connection = await amqp.connect(RABBITMQ_URL, {
      heartbeat: 60,
    });

    this.connection.on("error", (err: Error) => {
      console.error("RabbitMQ connection error:", err);
      process.exit(1);
    });

    this.connection.on("close", () => {
      console.warn("RabbitMQ connection closed");
      this.connection = null;
      this.publishChannel = null;
      this.consumerChannels.clear();
    });

    console.log("Connected to RabbitMQ");
  }

  async getPublishChannel(): Promise<Channel> {
    if (!this.connection) {
      throw new Error("RabbitMQ not connected");
    }
    if (!this.publishChannel) {
      this.publishChannel = await this.connection.createChannel();
      this.publishChannel.on("error", (err: Error) => {
        console.error("Publish channel error:", err);
        this.publishChannel = null;
      });
    }
    return this.publishChannel;
  }

  async getConsumerChannel(queueName: string, prefetch: number): Promise<Channel> {
    if (!this.connection) {
      throw new Error("RabbitMQ not connected");
    }

    const existing = this.consumerChannels.get(queueName);
    if (existing) return existing;

    const channel = await this.connection.createChannel();
    await channel.prefetch(prefetch);

    channel.on("error", (err: Error) => {
      console.error(`Consumer channel error [${queueName}]:`, err);
      this.consumerChannels.delete(queueName);
    });

    this.consumerChannels.set(queueName, channel);
    return channel;
  }

  async close(): Promise<void> {
    for (const [name, ch] of this.consumerChannels) {
      try {
        await ch.close();
      } catch {
        console.warn(`Failed to close consumer channel: ${name}`);
      }
    }
    this.consumerChannels.clear();

    if (this.publishChannel) {
      try {
        await this.publishChannel.close();
      } catch {
        // ignore
      }
      this.publishChannel = null;
    }

    if (this.connection) {
      try {
        await this.connection.close();
      } catch {
        // ignore
      }
      this.connection = null;
    }

    console.log("RabbitMQ connection closed");
  }
}

// Singleton
export const rabbitmq = new RabbitMQConnection();
