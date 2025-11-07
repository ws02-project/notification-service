import * as amqp from 'amqplib';
import protobuf from 'protobufjs';
import logger from '../utils/logger';

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;
type AmqpChannel = Awaited<ReturnType<AmqpConnection['createChannel']>>;

export interface EventHandler {
  eventType: string;
  messageName: string;
  handler: (event: Record<string, unknown>, metadata: EventMetadata) => Promise<void>;
}

export interface EventMetadata {
  eventId: string;
  eventType: string;
  sourceService: string;
  targetService?: string;
  timestamp: number;
  correlationId?: string;
  metadata?: Record<string, string>;
}

export interface ServiceRegistration {
  serviceName: string;
  queues: QueueConfig[];
  subscriptions: SubscriptionConfig[];
}

export interface QueueConfig {
  name: string;
  durable?: boolean;
  deadLetterQueue?: string;
  ttl?: number;
  maxLength?: number;
}

export interface SubscriptionConfig {
  eventType: string;
  routingKey: string;
  sourceService?: string;
}

/**
 * EventBus - Streamlined messaging system for microservices
 * Allows easy registration and protobuf-based message exchange
 */
export class EventBus {
  private connection: AmqpConnection | null = null;
  private channel: AmqpChannel | null = null;
  private exchange: string;
  private serviceName: string;
  private handlers: Map<string, EventHandler> = new Map();
  private protoRoot: protobuf.Root | null = null;

  constructor(serviceName: string, exchange: string = 'microservices.exchange') {
    this.serviceName = serviceName;
    this.exchange = exchange;
  }

  /**
   * Initialize the event bus with RabbitMQ connection
   */
  async initialize(connectionUrl: string, retryAttempts: number = 10): Promise<void> {
    let attempt = 0;

    while (attempt < retryAttempts) {
      try {
        attempt++;
        logger.info(`🐰 Connecting to RabbitMQ... (attempt ${attempt}/${retryAttempts})`);

        this.connection = await amqp.connect(connectionUrl);
        this.channel = await this.connection.createChannel();

        // Declare exchange
        await this.channel.assertExchange(this.exchange, 'topic', { durable: true });

        logger.info('✅ EventBus initialized successfully');
        return;
      } catch (error) {
        if (attempt >= retryAttempts) {
          throw error;
        }
        logger.warn(
          `Failed to connect to RabbitMQ (attempt ${attempt}/${retryAttempts}). Retrying in 3s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }
  }

  /**
   * Load protobuf schema
   */
  async loadProtoSchema(protoPath: string | string[]): Promise<void> {
    try {
      this.protoRoot = await protobuf.load(protoPath);
      logger.info(`✅ Loaded protobuf schemas`);
    } catch (error) {
      logger.error('Failed to load protobuf schema:', error);
      throw error;
    }
  }

  /**
   * Register service with queues and subscriptions
   */
  async registerService(registration: ServiceRegistration): Promise<void> {
    if (!this.channel) {
      throw new Error('EventBus not initialized');
    }

    logger.info(`📝 Registering service: ${registration.serviceName}`);

    // Create queues
    for (const queueConfig of registration.queues) {
      await this.createQueue(queueConfig);
    }

    // Setup subscriptions
    for (const subscription of registration.subscriptions) {
      await this.subscribe(subscription);
    }

    logger.info(`✅ Service ${registration.serviceName} registered successfully`);
  }

  /**
   * Create a queue with optional DLQ
   */
  private async createQueue(config: QueueConfig): Promise<void> {
    if (!this.channel) throw new Error('Channel not initialized');

    const { name, durable = true, deadLetterQueue, ttl, maxLength } = config;

    // Create DLQ if specified
    if (deadLetterQueue) {
      await this.channel.assertQueue(deadLetterQueue, {
        durable: true,
        arguments: {
          'x-message-ttl': 604800000, // 7 days
        },
      });
      await this.channel.bindQueue(deadLetterQueue, this.exchange, `${deadLetterQueue}.#`);
      logger.info(`✅ Dead Letter Queue '${deadLetterQueue}' created`);
    }

    // Create main queue
    const queueArgs: Record<string, unknown> = {};
    if (ttl) queueArgs['x-message-ttl'] = ttl;
    if (maxLength) queueArgs['x-max-length'] = maxLength;
    if (deadLetterQueue) {
      queueArgs['x-dead-letter-exchange'] = this.exchange;
      queueArgs['x-dead-letter-routing-key'] = deadLetterQueue;
    }

    await this.channel.assertQueue(name, {
      durable,
      arguments: Object.keys(queueArgs).length > 0 ? queueArgs : undefined,
    });

    logger.info(`✅ Queue '${name}' created`);
  }

  /**
   * Subscribe to events from other services
   */
  private async subscribe(subscription: SubscriptionConfig): Promise<void> {
    if (!this.channel) throw new Error('Channel not initialized');

    const queueName = `${this.serviceName}.events`;

    // Bind queue to routing key
    await this.channel.bindQueue(queueName, this.exchange, subscription.routingKey);

    logger.info(`✅ Subscribed to '${subscription.eventType}' (${subscription.routingKey})`);
  }

  /**
   * Register an event handler
   */
  on(
    eventType: string,
    messageName: string,
    handler: (event: Record<string, unknown>, metadata: EventMetadata) => Promise<void>,
  ): void {
    this.handlers.set(eventType, {
      eventType,
      messageName,
      handler,
    });
    logger.info(`📝 Handler registered for event: ${eventType}`);
  }

  /**
   * Start consuming messages
   */
  async startConsuming(): Promise<void> {
    if (!this.channel) throw new Error('Channel not initialized');

    const queueName = `${this.serviceName}.events`;

    // Set prefetch
    await this.channel.prefetch(1);

    logger.info(`📥 Starting to consume from queue '${queueName}'`);

    await this.channel.consume(queueName, async (msg) => {
      if (!msg) return;

      try {
        // Parse metadata from message properties
        const metadata: EventMetadata = JSON.parse(msg.properties.headers?.metadata || '{}');
        const eventType = metadata.eventType;

        logger.info(`📨 Received event: ${eventType}`);

        // Find handler
        const handlerConfig = this.handlers.get(eventType);
        if (!handlerConfig) {
          logger.warn(`No handler registered for event: ${eventType}`);
          this.channel!.ack(msg);
          return;
        }

        // Deserialize protobuf message
        const MessageType = this.protoRoot!.lookupType(handlerConfig.messageName);
        const event = MessageType.decode(msg.content);
        const eventObject = MessageType.toObject(event);

        // Execute handler
        await handlerConfig.handler(eventObject, metadata);

        // Acknowledge message
        this.channel!.ack(msg);
        logger.info(`✅ Successfully processed ${eventType}`);
      } catch (error) {
        logger.error('Error processing message:', error);
        // Send to DLQ
        this.channel!.nack(msg, false, false);
      }
    });

    logger.info(`✅ Consumer started for ${this.serviceName}`);
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
    logger.info('✅ EventBus closed');
  }
}
