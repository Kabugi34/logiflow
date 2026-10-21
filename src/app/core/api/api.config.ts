export const API_CONFIG = {
  apiRoot: 'https://7787-129-222-187-129.ngrok-free.app/api',
  baseUrl: 'https://7787-129-222-187-129.ngrok-free.app/api/v1',
  auth: {
    accessRequest: '/access-requests',
    activate: '/access-requests/activate',
    activationResend: '/auth/resend-verification',
    login: '/auth/login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    me: '/users/me',
    passwordResetRequest: '/auth/forgot-password',
    passwordReset: '/auth/reset-password'
  }
};
