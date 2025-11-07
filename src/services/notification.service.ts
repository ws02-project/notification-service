import logger from '../utils/logger';
import { sendTaskAssignmentEmail } from './email.service';
import { EventMetadata } from '../messaging/EventBus';

/**
 * Handle task assigned event
 */
export async function handleTaskAssigned(
  event: Record<string, unknown>,
  metadata: EventMetadata,
): Promise<void> {
  try {
    logger.info('📧 Processing task assignment notification', {
      taskId: event.taskId,
      assignedTo: event.assignedTo,
      eventId: metadata.eventId,
    });

    const taskId = event.taskId as string;
    const assignedTo = event.assignedTo as string;
    const projectId = event.projectId as string | undefined;
    const assignedBy = event.assignedBy as string | undefined;

    // For now, we'll use assignedTo as email
    // In a real system, you'd look up the user's email from a user service
    const assigneeEmail = assignedTo;

    if (!assigneeEmail) {
      logger.warn('⚠️ No email address found for assigned user', { taskId, assignedTo });
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

    logger.info('✅ Task assignment notification sent successfully', {
      taskId,
      assigneeEmail,
    });
  } catch (error) {
    logger.error('❌ Failed to handle task assignment notification:', error);
    throw error;
  }
}
