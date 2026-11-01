export const isCanceled = (error) => error?.code === 'ERR_CANCELED';

/** A message that is safe and useful to show to the user. */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (isCanceled(error)) return '';
  if (error?.response) return error.response.data?.error?.message || fallback;
  if (error?.request || error?.code === 'ECONNABORTED') {
    return 'Cannot reach the server. Check your connection and try again.';
  }
  return fallback;
}

/** Turns the API's validation details into { fieldName: message }. */
export function getFieldErrors(error) {
  const details = error?.response?.data?.error?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(details.map((d) => [d.field, d.message]));
}
