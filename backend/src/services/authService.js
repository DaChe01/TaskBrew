import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from '../errors/AppError.js';

export function createAuthService({ config, userRepository }) {
  // Used to burn the same CPU time when an email is unknown, so response time
  // does not reveal which emails are registered.
  const dummyHash = bcrypt.hashSync('not-a-real-password', config.bcryptRounds);

  const signToken = (userId) =>
    jwt.sign({ id: userId }, config.jwtSecret, {
      algorithm: 'HS256',
      expiresIn: config.jwtExpiresIn,
    });

  const toPublicUser = ({ id, name, email, email_reminders }) => ({
    id,
    name,
    email,
    email_reminders,
  });

  return {
    async register({ name, email, password }) {
      const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
      try {
        // Rely on the UNIQUE constraint instead of "check then insert" (race-free).
        const user = await userRepository.create({ name, email, passwordHash });
        return { token: signToken(user.id), user: toPublicUser(user) };
      } catch (err) {
        if (err.code === '23505') {
          throw AppError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
        }
        throw err;
      }
    },

    async login({ email, password }) {
      const user = await userRepository.findByEmail(email);
      const valid = await bcrypt.compare(password, user?.password_hash ?? dummyHash);
      if (!user || !valid) {
        throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
      }
      return { token: signToken(user.id), user: toPublicUser(user) };
    },

    async setEmailReminders(userId, enabled) {
      const user = await userRepository.setEmailReminders(userId, enabled);
      if (!user) throw AppError.notFound('User not found');
      return toPublicUser(user);
    },
  };
}
