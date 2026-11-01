import client from './client.js';

export const registerRequest = (payload) =>
  client.post('/auth/register', payload).then((res) => res.data.data);

export const loginRequest = (payload) =>
  client.post('/auth/login', payload).then((res) => res.data.data);

export const updateReminderPreference = (emailReminders) =>
  client.patch('/auth/me', { email_reminders: emailReminders }).then((res) => res.data.data.user);
