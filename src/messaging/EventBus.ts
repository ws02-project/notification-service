import * as amqp from 'amqplib';
import protobuf from 'protobufjs';
import { v4 as uuidv4 } from 'uuid';
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
 * Includes automatic reconnection on connection loss
 */
export class EventBus {
  private connection: AmqpConnection | null = null;
  private channel: AmqpChannel | null = null;
  private exchange: string;
  private serviceName: string;
  private handlers: Map<string, EventHandler> = new Map();
  private protoRoot: protobuf.Root | null = null;

  // Reconnection state
  private connectionUrl: string = '';
  private isReconnecting: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 50;
  private serviceRegistration: ServiceRegistration | null = null;
  private isConsuming: boolean = false;

  constructor(serviceName: string, exchange: string = 'microservices.exchange') {
    this.serviceName = serviceName;
    this.exchange = exchange;
  }

  /**
   * Check if connection is healthy
   */
  isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
  }

  /**
   * Initialize the event bus with RabbitMQ connection
   */
  async initialize(connectionUrl: string, retryAttempts: number = 10): Promise<void> {
    this.connectionUrl = connectionUrl;
    this.maxReconnectAttempts = retryAttempts;

    await this.connect(retryAttempts);
  }

  /**
   * Connect to RabbitMQ with retry logic
   */
  private async connect(retryAttempts: number = 10): Promise<void> {
    let attempt = 0;

    while (attempt < retryAttempts) {
      try {
        attempt++;
        logger.info(`🐰 Connecting to RabbitMQ... (attempt ${attempt}/${retryAttempts})`);

        this.connection = await amqp.connect(this.connectionUrl);
        this.channel = await this.connection.createChannel();

        // Setup connection error handlers
        this.setupConnectionHandlers();

        // Declare exchange
        await this.channel.assertExchange(this.exchange, 'topic', { durable: true });

        // Reset reconnect attempts on successful connection
        this.reconnectAttempts = 0;
        this.isReconnecting = false;

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
   * Setup connection and channel error handlers for automatic reconnection
   */
  private setupConnectionHandlers(): void {
    if (!this.connection || !this.channel) return;

    // Connection error handler
    this.connection.on('error', (err) => {
      logger.error('RabbitMQ connection error:', err.message);
      this.handleConnectionLoss();
    });

    // Connection close handler
    this.connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      this.handleConnectionLoss();
    });

    // Channel error handler
    this.channel.on('error', (err) => {
      logger.error('RabbitMQ channel error:', err.message);
      this.handleConnectionLoss();
    });

    // Channel close handler
    this.channel.on('close', () => {
      logger.warn('RabbitMQ channel closed');
      this.handleConnectionLoss();
    });
  }

  /**
   * Handle connection loss - attempt to reconnect
   */
  private handleConnectionLoss(): void {
    // Prevent multiple simultaneous reconnection attempts
    if (this.isReconnecting) {
      return;
    }

    this.isReconnecting = true;
    this.connection = null;
    this.channel = null;

    // Start reconnection with exponential backoff
    this.reconnect();
  }

  /**
   * Reconnect to RabbitMQ with exponential backoff
   */
  private async reconnect(): Promise<void> {
    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;

      // Exponential backoff: 1s, 2s, 4s, 8s, ... max 30s
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);

      logger.info(
        `🔄 Attempting to reconnect to RabbitMQ (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms...`,
      );

      await new Promise((resolve) => setTimeout(resolve, delay));

      try {
        await this.connect(1); // Single attempt per iteration

        // Re-register service if we had one
        if (this.serviceRegistration) {
          logger.info('🔄 Re-registering service after reconnection...');
          await this.registerService(this.serviceRegistration);
        }

        // Restart consuming if we were consuming
        if (this.isConsuming) {
          logger.info('🔄 Restarting consumer after reconnection...');
          await this.startConsuming();
        }

        logger.info('✅ Successfully reconnected to RabbitMQ');
        return;
      } catch (error) {
        logger.warn(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
      }
    }

    // Max retries exceeded - exit to let K8s restart the pod
    logger.error(
      `❌ Failed to reconnect to RabbitMQ after ${this.maxReconnectAttempts} attempts. Exiting...`,
    );
    process.exit(1);
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

    // Store registration for reconnection
    this.serviceRegistration = registration;

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

    // Track that we're consuming for reconnection
    this.isConsuming = true;

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
   * Publish an event to other services
   */
  async publish(
    eventType: string,
    routingKey: string,
    messageName: string,
    payload: Record<string, unknown>,
    options: {
      targetService?: string;
      correlationId?: string;
      metadata?: Record<string, string>;
    } = {},
  ): Promise<void> {
    // Check if we're currently reconnecting
    if (this.isReconnecting) {
      logger.warn(`Cannot publish ${eventType}: RabbitMQ is reconnecting...`);
      throw new Error('RabbitMQ connection is reconnecting');
    }

    if (!this.channel || !this.protoRoot) {
      throw new Error('EventBus not initialized or schema not loaded');
    }

    try {
      // Serialize message to protobuf
      const MessageType = this.protoRoot.lookupType(messageName);
      const errMsg = MessageType.verify(payload);
      if (errMsg) throw new Error(errMsg);

      const message = MessageType.create(payload);
      const buffer = Buffer.from(MessageType.encode(message).finish());

      // Create metadata
      const eventMetadata: EventMetadata = {
        eventId: uuidv4(),
        eventType,
        sourceService: this.serviceName,
        targetService: options.targetService,
        timestamp: Date.now(),
        correlationId: options.correlationId,
        metadata: options.metadata,
      };

      // Publish to exchange
      this.channel.publish(this.exchange, routingKey, buffer, {
        persistent: true,
        contentType: 'application/x-protobuf',
        headers: {
          metadata: JSON.stringify(eventMetadata),
        },
      });

      logger.info(`📤 Published event: ${eventType} (${routingKey})`);
    } catch (error) {
      logger.error(`Failed to publish event ${eventType}:`, error);
      throw error;
    }
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
