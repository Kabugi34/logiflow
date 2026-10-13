export const API_CONFIG = {
  apiRoot: 'http://localhost:8080/api',
  baseUrl: 'http://localhost:8080/api',
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
