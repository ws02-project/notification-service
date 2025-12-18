import logger from '../utils/logger';
import { sendTaskAssignmentEmail } from './email.service';
import { EventMetadata } from '../messaging/EventBus';
import { getUserEmail } from '../grpc/user.grpc.client';

/**
 * Handle task assigned event
 */
export async function handleTaskAssigned(
  event: Record<string, unknown>,
  metadata: EventMetadata,
): Promise<void> {
  const startTime = Date.now();
  const taskId = event.taskId as string;
  const assignedTo = event.assignedTo as string;
  const projectId = event.projectId as string | undefined;
  const assignedBy = event.assignedBy as string | undefined;

  logger.info('Event received - task.assigned', {
    type: 'event_received',
    eventType: 'task.assigned',
    eventId: metadata.eventId,
    taskId,
    assignedTo,
    projectId,
    sourceService: metadata.sourceService,
  });

  // Check if assignedTo is provided
  if (!assignedTo) {
    logger.warn('Notification skipped - No assignee', {
      type: 'notification_skipped',
      reason: 'no_assignee',
      taskId,
    });
    return;
  }

  try {
    // Get the user's email from user-service via gRPC
    const assigneeEmail = await getUserEmail(assignedTo);

    if (!assigneeEmail) {
      logger.warn('Notification skipped - No email found for user', {
        type: 'notification_skipped',
        reason: 'no_email',
        taskId,
        userId: assignedTo,
      });
      return;
    }

    // Extract task title from event (if available)
    const taskTitle = (event.title as string) || 'Untitled Task';
    const taskDescription = (event.description as string) || undefined;

    await sendTaskAssignmentEmail(assigneeEmail, {
      taskId,
      taskTitle,
      taskDescription,
      projectId,
      assignedBy,
    });

    logger.info('Notification sent successfully', {
      type: 'notification_sent',
      notificationType: 'task_assignment',
      taskId,
      recipient: assigneeEmail,
      projectId,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    logger.error('Notification failed', {
      type: 'notification_failed',
      notificationType: 'task_assignment',
      taskId,
      assignedTo,
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    });
    throw error;
  }
}
