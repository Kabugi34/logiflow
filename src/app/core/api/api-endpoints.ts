import { API_CONFIG } from './api.config';

/** Central route registry. Keep HTTP behavior and response mapping in services. */
export const API_ENDPOINTS = {
  auth: {
    accessRequest: `${API_CONFIG.apiRoot}/access-requests`,
    activate: `${API_CONFIG.apiRoot}/access-requests/activate`,
    activationResend: `${API_CONFIG.apiRoot}/auth/resend-verification`,
    login: `${API_CONFIG.apiRoot}/auth/login`,
    refresh: `${API_CONFIG.apiRoot}/auth/refresh`,
    logout: `${API_CONFIG.apiRoot}/auth/logout`,
    me: `${API_CONFIG.apiRoot}/users/me`,
    passwordResetRequest: `${API_CONFIG.apiRoot}/auth/forgot-password`,
    passwordReset: `${API_CONFIG.apiRoot}/auth/reset-password`
  },
  manufacturer: {
    stockItems: `${API_CONFIG.apiRoot}/stock/items`,
    purchaseOrders: `${API_CONFIG.baseUrl}/manufacturer/purchase-orders`,
    purchaseOrderDecision: (id: string) => `${API_CONFIG.baseUrl}/manufacturer/purchase-orders/${encodeURIComponent(id)}/decision`
  },
  distributor: {
    products: `${API_CONFIG.baseUrl}/products`,
    purchaseOrders: `${API_CONFIG.baseUrl}/purchase-orders`,
    purchaseOrder: (id: string) => `${API_CONFIG.baseUrl}/purchase-orders/${encodeURIComponent(id)}`,
    purchaseOrderSettlements: (id: string) => `${API_CONFIG.baseUrl}/purchase-orders/${encodeURIComponent(id)}/settlements`,
    orders: `${API_CONFIG.baseUrl}/orders`,
    orderStatus: (id: string) => `${API_CONFIG.baseUrl}/orders/${encodeURIComponent(id)}/status`,
    paymentInitiate: `${API_CONFIG.baseUrl}/payments/initiate`,
    paymentStatus: (orderId: string) => `${API_CONFIG.baseUrl}/payments/${encodeURIComponent(orderId)}/status`,
    stockItems: `${API_CONFIG.apiRoot}/stock/items`,
    stockItem: (id: string) => `${API_CONFIG.apiRoot}/stock/items/${encodeURIComponent(id)}`,
    restockRequests: `${API_CONFIG.apiRoot}/stock/restock-request`,
    restockRequestStatus: (id: string) => `${API_CONFIG.apiRoot}/stock/restock-request/${encodeURIComponent(id)}/status`,
    stockOffers: `${API_CONFIG.apiRoot}/stock/offers`,
    stockOffer: (id: string) => `${API_CONFIG.apiRoot}/stock/offers/${encodeURIComponent(id)}`,
    warehouses: `${API_CONFIG.baseUrl}/warehouses`,
    trips: `${API_CONFIG.baseUrl}/trips`,
    tripTracking: (id: string) => `${API_CONFIG.baseUrl}/trips/${encodeURIComponent(id)}/tracking`,
    tripAssignment: (id: string) => `${API_CONFIG.baseUrl}/trips/${encodeURIComponent(id)}/assign`,
    tripStatus: (id: string) => `${API_CONFIG.baseUrl}/trips/${encodeURIComponent(id)}/status`
  }
} as const;
