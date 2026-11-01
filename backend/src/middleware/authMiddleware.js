import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError.js';

/**
 * Verifies the Bearer token and attaches the user to req.user.
 * Receives its dependencies explicitly so it is easy to test.
 */
export function createAuthMiddleware({ config, userRepository }) {
  return async function protect(req, _res, next) {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return next(AppError.unauthorized('Authentication required', 'AUTH_REQUIRED'));
    }

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(
          AppError.unauthorized('Your session has expired. Please log in again.', 'TOKEN_EXPIRED'),
        );
      }
      return next(AppError.unauthorized('Invalid authentication token', 'INVALID_TOKEN'));
    }

    // Look the user up so tokens of deleted accounts stop working immediately.
    const user = await userRepository.findPublicById(payload.id);
    if (!user) {
      return next(AppError.unauthorized('Account no longer exists', 'INVALID_TOKEN'));
    }

    req.user = user;
    return next();
  };
}
