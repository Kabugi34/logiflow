export const API_CONFIG = {
  apiRoot: 'http://localhost:8080/api',
  baseUrl: 'http://localhost:8080/api/v1',
  auth: {
    accessRequest: '/access-requests',
    activate: '/access-requests/activate',
    activationResend: '/auth/activation/resend',
    login: '/auth/login',
    logout: '/auth/logout',
    me: '/auth/me',
    passwordResetRequest: '/auth/password/forgot',
    passwordReset: '/auth/password/reset'
  }
};