import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import validate from '../middlewares/validate';
import * as notificationValidation from '../validations/notification.validation';

const router: Router = Router();

// Health check endpoint
router.get('/health', notificationController.healthCheck);

// Test email endpoint
router.post(
  '/test-email',
  validate(notificationValidation.sendTestEmailSchema),
  notificationController.sendTestEmail,
);

export default router;
