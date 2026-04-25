declare module 'amqplib' {
  interface Options {
    Publish?: {
      persistent?: boolean;
      headers?: Record<string, unknown>;
      contentType?: string;
      messageId?: string;
      timestamp?: number;
      appId?: string;
    };
  }

  namespace Options {
    interface Publish {
      persistent?: boolean;
      headers?: Record<string, unknown>;
      contentType?: string;
      messageId?: string;
      timestamp?: number;
      appId?: string;
    }
  }

  interface QueueProperties {
    queue: string;
    messageCount: number;
    consumerCount: number;
  }

  interface PurgeProperties {
    messageCount: number;
  }

  interface DeleteProperties {
    messageCount: number;
  }

  interface ConsumeProperties {
    consumerTag: string;
  }

  interface MessageProperties {
    headers?: Record<string, unknown>;
    appId?: string;
    messageId?: string;
    timestamp?: number;
    contentType?: string;
    contentEncoding?: string;
    deliveryMode?: number;
    priority?: number;
    correlationId?: string;
    replyTo?: string;
    expiration?: string;
  }

  interface MessageFields {
    routingKey: string;
    exchange: string;
    deliveryTag: number;
    redelivered: boolean;
  }

  interface Message {
    content: Buffer;
    fields: MessageFields;
    properties: MessageProperties;
  }

  interface Channel {
    prefetch(count: number): Promise<boolean>;
    assertQueue(
      queue: string,
      options?: {
        durable?: boolean;
        deadLetterExchange?: string;
        deadLetterRoutingKey?: string;
        messageTtl?: number;
        arguments?: Record<string, unknown>;
      },
    ): Promise<QueueProperties>;
    checkQueue(queue: string): Promise<QueueProperties>;
    sendToQueue(
      queue: string,
      content: Buffer,
      options?: Options.Publish,
    ): boolean;
    consume(
      queue: string,
      onMessage: (msg: Message | null) => void,
      options?: { noAck?: boolean },
    ): Promise<ConsumeProperties>;
    ack(message: Message, allUpTo?: boolean): void;
    nack(message: Message, allUpTo?: boolean, requeue?: boolean): void;
    cancel(consumerTag: string): Promise<boolean>;
    assertExchange(
      exchange: string,
      type: string,
      options?: { durable?: boolean; autoDelete?: boolean },
    ): Promise<{ exchange: string }>;
    publish(
      exchange: string,
      routingKey: string,
      content: Buffer,
      options?: Options.Publish,
    ): boolean;
    bindQueue(
      queue: string,
      source: string,
      pattern: string,
      args?: Record<string, unknown>,
    ): Promise<Record<string, never>>;
    purgeQueue(queue: string): Promise<PurgeProperties>;
    deleteQueue(
      queue: string,
      options?: { ifUnused?: boolean; ifEmpty?: boolean },
    ): Promise<DeleteProperties>;
    close(): Promise<void>;
  }

  interface Connection {
    createChannel(): Promise<Channel>;
    close(): Promise<void>;
  }

  function connect(
    url: string,
    socketOptions?: Record<string, unknown>,
  ): Promise<Connection>;
}
