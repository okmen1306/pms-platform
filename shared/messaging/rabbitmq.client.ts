import amqplib, { type Channel, type ChannelModel } from 'amqplib';
import {
  PMS_EVENTS_EXCHANGE,
  PMS_EVENTS_EXCHANGE_TYPE,
  PMS_EVENTS_DLX,
  PMS_EVENTS_DLQ,
} from './topology';

/**
 * Tüm servislerin RabbitMQ'ya bağlanmak için kullandığı TEK ortak istemci. Her servis kendi
 * bağlantısını açar (connection paylaşılmaz), ama exchange/DLX kurulumu burada merkezi olarak
 * tanımlıdır ki hiçbir servis kendi topolojisini farklı şekilde kurmasın.
 */
export class RabbitMqClient {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly url: string) {}

  async connect(): Promise<void> {
    this.connection = await amqplib.connect(this.url);
    this.channel = await this.connection.createChannel();

    await this.channel.assertExchange(PMS_EVENTS_EXCHANGE, PMS_EVENTS_EXCHANGE_TYPE, {
      durable: true,
    });
    await this.channel.assertExchange(PMS_EVENTS_DLX, 'fanout', { durable: true });
    await this.channel.assertQueue(PMS_EVENTS_DLQ, { durable: true });
    await this.channel.bindQueue(PMS_EVENTS_DLQ, PMS_EVENTS_DLX, '');
  }

  async publish(routingKey: string, payload: unknown): Promise<void> {
    if (!this.channel) throw new Error('RabbitMqClient.connect() önce çağrılmalı');
    this.channel.publish(PMS_EVENTS_EXCHANGE, routingKey, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
      contentType: 'application/json',
    });
  }

  async subscribe(
    queue: string,
    routingKeys: string[],
    onMessage: (routingKey: string, payload: unknown) => Promise<void>,
  ): Promise<void> {
    if (!this.channel) throw new Error('RabbitMqClient.connect() önce çağrılmalı');
    await this.channel.assertQueue(queue, {
      durable: true,
      deadLetterExchange: PMS_EVENTS_DLX,
    });
    for (const key of routingKeys) {
      await this.channel.bindQueue(queue, PMS_EVENTS_EXCHANGE, key);
    }
    await this.channel.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        const payload = JSON.parse(msg.content.toString());
        await onMessage(msg.fields.routingKey, payload);
        this.channel!.ack(msg);
      } catch (err) {
        // İşlenemeyen mesaj: requeue etmeden nack -> DLX'e düşer (kaybolmaz, sonsuz döngü olmaz)
        this.channel!.nack(msg, false, false);
      }
    });
  }

  async close(): Promise<void> {
    await this.channel?.close();
    await this.connection?.close();
  }
}
