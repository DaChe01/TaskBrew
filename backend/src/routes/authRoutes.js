import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { loginRules, registerRules, updateMeRules } from '../validators/authValidators.js';

export function createAuthRoutes({ config, authController, protect }) {
  const router = Router();

  // Slows down password guessing. Counted per client IP (see TRUST_PROXY in the README).
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.authRateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many attempts. Please try again in a few minutes.',
        },
      }),
  });

  router.post('/register', limiter, registerRules, authController.register);
  router.post('/login', limiter, loginRules, authController.login);
  router.get('/me', protect, authController.me);
  router.patch('/me', protect, updateMeRules, authController.updateMe);

  return router;
}
