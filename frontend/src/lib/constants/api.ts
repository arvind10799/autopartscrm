export const DEFAULT_BACKEND_API_URL = 'http://localhost:3000';
export const DEFAULT_API_TIMEOUT_MS = 10000;
export const DEFAULT_AUTH_COOKIE_MAX_AGE_SECONDS = 86400;

export const API_ERROR_MESSAGES = {
  invalidEnvelope: 'The API response format was invalid.',
  invalidData: 'The API response payload was invalid.',
  emptyData: 'The API response did not include any data.',
  requestFailed: 'Request failed.',
  unexpectedResponse: 'Backend returned an unexpected response.',
  timeout: 'The backend service took too long to respond.',
  network: 'Unable to reach the backend service.',
  unexpected: 'Unexpected request failure.',
} as const;
