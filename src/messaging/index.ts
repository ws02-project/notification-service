import { EventBus, ServiceRegistration } from './EventBus';
import { config } from '../config';
import logger from '../utils/logger';
import { handleTaskAssigned } from '../services/notification.service';

// Create EventBus instance
export const eventBus = new EventBus('notification-service', 'microservices.exchange');

/**
 * Initialize and register the notification-service with the messaging system
 */
export async function initializeMessaging(): Promise<void> {
  try {
    // Initialize connection
    await eventBus.initialize(config.rabbitmq.url);

    // Load protobuf schemas (mounted volume in Docker)
    await eventBus.loadProtoSchema(['/app/proto/task.proto']);

    // Define service registration
    const registration: ServiceRegistration = {
      serviceName: 'notification-service',

      // Define queues this service owns
      queues: [
        {
          name: 'notification-service.events',
          durable: true,
          deadLetterQueue: 'notification-service.dlq',
          ttl: 31536000000, // 1 year
          maxLength: 10000,
        },
      ],

      // Subscribe to events from other services
      subscriptions: [
        {
          eventType: 'task.assigned',
          routingKey: 'task.assigned',
          sourceService: 'task-service',
        },
      ],
    };

    // Register the service
    await eventBus.registerService(registration);

    // Register event handlers
    registerEventHandlers();

    // Start consuming
    await eventBus.startConsuming();

    logger.info('✅ Messaging system initialized for notification-service');
  } catch (error) {
    logger.error('Failed to initialize messaging:', error);
    throw error;
  }
}

/**
 * Register handlers for events from other services
 */
function registerEventHandlers(): void {
  // Handle task assigned event
  eventBus.on('task.assigned', 'task.TaskAssignedEvent', handleTaskAssigned);
}

/**
 * Close messaging connections
 */
export async function closeMessaging(): Promise<void> {
  await eventBus.close();
}
