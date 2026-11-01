import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createAuthController } from './controllers/authController.js';
import { createTaskController } from './controllers/taskController.js';
import { createAuthMiddleware } from './middleware/authMiddleware.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { createReminderRepository } from './reminders/reminderRepository.js';
import { createReminderService } from './reminders/reminderService.js';
import { createTaskRepository } from './repositories/taskRepository.js';
import { createUserRepository } from './repositories/userRepository.js';
import { createAuthRoutes } from './routes/authRoutes.js';
import { createReminderRoutes } from './routes/reminderRoutes.js';
import { createTaskRoutes } from './routes/taskRoutes.js';
import { createAuthService } from './services/authService.js';
import { createTaskService } from './services/taskService.js';

/**
 * Builds the Express app from its dependencies. It does not open a port or a
 * database connection itself, so tests can create as many apps as they need.
 *
 * @returns {{ app: import('express').Express, reminderService: object }}
 */
export function createApp({ config, pool, mailer = null }) {
  // Wire the layers together: repository -> service -> controller -> routes.
  const userRepository = createUserRepository(pool);
  const taskRepository = createTaskRepository(pool);
  const reminderRepository = createReminderRepository(pool);

  const authService = createAuthService({ config, userRepository });
  const taskService = createTaskService({ config, taskRepository });
  const reminderService = createReminderService({ config, reminderRepository, mailer });

  const protect = createAuthMiddleware({ config, userRepository });
  const authController = createAuthController({ authService });
  const taskController = createTaskController({ taskService });

  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy !== false) app.set('trust proxy', config.trustProxy);

  app.use(helmet());
  app.use(
    cors({
      // Bearer tokens are sent in a header, so cookies/credentials are not needed.
      origin(origin, callback) {
        // Requests without an Origin header (curl, server-to-server) are not browser CORS requests.
        if (!origin || config.frontendUrls.includes(origin)) return callback(null, true);
        return callback(null, false);
      },
    }),
  );
  app.use(express.json({ limit: '10kb' }));

  app.get('/api/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ success: true, data: { status: 'ok' } });
  });
  app.use('/api/auth', createAuthRoutes({ config, authController, protect }));
  app.use('/api/tasks', createTaskRoutes({ taskController, protect }));
  app.use('/api/reminders', createReminderRoutes({ config, reminderService }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return { app, reminderService };
}
