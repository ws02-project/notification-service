import nodemailer from 'nodemailer';
import { config } from '../config';
import logger from '../utils/logger';

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  auth: {
    user: config.email.user,
    pass: config.email.password,
  },
});

/**
 * Verify email configuration
 */
export async function verifyEmailConfig(): Promise<boolean> {
  try {
    await transporter.verify();
    logger.info('✅ Email transporter verified successfully');
    return true;
  } catch (error) {
    logger.error('❌ Email transporter verification failed:', error);
    return false;
  }
}

/**
 * Send task assignment notification email
 */
export async function sendTaskAssignmentEmail(
  assigneeEmail: string,
  taskData: {
    taskId: string;
    taskTitle: string;
    taskDescription?: string;
    projectId?: string;
    assignedBy?: string;
  },
): Promise<void> {
  const { taskId, taskTitle, taskDescription, projectId, assignedBy } = taskData;

  const mailOptions = {
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to: assigneeEmail,
    subject: `New Task Assigned: ${taskTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background-color: #4CAF50;
              color: white;
              padding: 20px;
              text-align: center;
              border-radius: 5px 5px 0 0;
            }
            .content {
              background-color: #f9f9f9;
              padding: 20px;
              border-radius: 0 0 5px 5px;
            }
            .task-info {
              background-color: white;
              padding: 15px;
              border-left: 4px solid #4CAF50;
              margin: 15px 0;
            }
            .task-title {
              font-size: 18px;
              font-weight: bold;
              color: #4CAF50;
              margin-bottom: 10px;
            }
            .task-details {
              color: #666;
              font-size: 14px;
            }
            .footer {
              text-align: center;
              margin-top: 20px;
              color: #999;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>New Task Assigned</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>You have been assigned a new task:</p>
            
            <div class="task-info">
              <div class="task-title">${taskTitle}</div>
              ${taskDescription ? `<div class="task-details"><strong>Description:</strong> ${taskDescription}</div>` : ''}
              ${taskId ? `<div class="task-details"><strong>Task ID:</strong> ${taskId}</div>` : ''}
              ${projectId ? `<div class="task-details"><strong>Project ID:</strong> ${projectId}</div>` : ''}
              ${assignedBy ? `<div class="task-details"><strong>Assigned by:</strong> ${assignedBy}</div>` : ''}
            </div>
            
            <p>Please log in to your account to view and work on this task.</p>
            
            <div class="footer">
              <p>This is an automated notification from the Task Management System.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
New Task Assigned

Hello,

You have been assigned a new task:

Task: ${taskTitle}
${taskDescription ? `Description: ${taskDescription}` : ''}
${taskId ? `Task ID: ${taskId}` : ''}
${projectId ? `Project ID: ${projectId}` : ''}
${assignedBy ? `Assigned by: ${assignedBy}` : ''}

Please log in to your account to view and work on this task.

This is an automated notification from the Task Management System.
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info('Email sent successfully', {
      type: 'email_sent',
      emailType: 'task_assignment',
      recipient: assigneeEmail,
      messageId: info.messageId,
      taskId,
      projectId,
    });
  } catch (error) {
    logger.error('Email send failed', {
      type: 'email_failed',
      emailType: 'task_assignment',
      recipient: assigneeEmail,
      taskId,
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error',
      retryable: error instanceof Error ? isRetryableEmailError(error) : false,
    });
    throw error;
  }
}

/**
 * Check if an email error is retryable
 */
function isRetryableEmailError(error: Error): boolean {
  const message = error.message.toLowerCase();
  return (
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('econnrefused') ||
    message.includes('temporarily') ||
    message.includes('try again')
  );
}

/**
 * Send test email
 */
export async function sendTestEmail(to: string, subject: string, message: string): Promise<void> {
  const mailOptions = {
    from: `"${config.email.fromName}" <${config.email.from}>`,
    to,
    subject,
    text: message,
    html: `<p>${message.replace(/\n/g, '<br>')}</p>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info('Test email sent', {
      type: 'email_sent',
      emailType: 'test',
      recipient: to,
      messageId: info.messageId,
    });
  } catch (error) {
    logger.error('Test email failed', {
      type: 'email_failed',
      emailType: 'test',
      recipient: to,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}
