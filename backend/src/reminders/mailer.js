import nodemailer from 'nodemailer';

/**
 * Creates the email sender. Returns null when SMTP is not configured, which
 * simply turns the reminder feature off.
 */
export function createMailer(config) {
  const { smtp, enabled } = config.reminders;
  if (!enabled) return null;

  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });

  return {
    sendMail: ({ to, subject, text, html }) =>
      transport.sendMail({ from: smtp.from, to, subject, text, html }),
  };
}
