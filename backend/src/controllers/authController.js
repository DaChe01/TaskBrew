import { matchedData } from 'express-validator';

export function createAuthController({ authService }) {
  return {
    async register(req, res) {
      const result = await authService.register(matchedData(req, { locations: ['body'] }));
      res.status(201).json({ success: true, data: result });
    },

    async login(req, res) {
      const result = await authService.login(matchedData(req, { locations: ['body'] }));
      res.json({ success: true, data: result });
    },

    me(req, res) {
      res.json({ success: true, data: { user: req.user } });
    },

    async updateMe(req, res) {
      const { email_reminders } = matchedData(req, { locations: ['body'] });
      const user = await authService.setEmailReminders(req.user.id, email_reminders);
      res.json({ success: true, data: { user } });
    },
  };
}
