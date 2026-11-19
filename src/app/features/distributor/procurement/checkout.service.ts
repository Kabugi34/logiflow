import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';

export type CheckoutStatus = 'PAYMENT_PENDING' | 'PAID' | 'PAYMENT_FAILED' | 'CANCELLED' | 'UNKNOWN';
export type CheckoutPaymentMethod = 'MPESA_SANDBOX' | 'DEMO';
export type CheckoutPaymentStatus =
  | 'PENDING' | 'INITIATED' | 'PROCESSING'
  | 'SUCCESS' | 'SUCCEEDED' | 'PAID'
  | 'FAILED' | 'CANCELLED' | 'TIMED_OUT' | 'EXPIRED'
  | 'REVERSED' | 'REFUNDED' | 'UNKNOWN';

export interface CheckoutResponse {
  id: string;
  checkoutReference: string;
  status: CheckoutStatus;
  totalAmount: number;
  currency: string;
  demo: boolean;
  demoLabel: string;
  payment: null | {
    id: string;
    method: CheckoutPaymentMethod;
    status: CheckoutPaymentStatus;
    demo: boolean;
    demoLabel: string;
    paymentReference?: string | null;
    reference?: string | null;
    customerMessage?: string | null;
    failureReason?: string | null;
  };
  supplierOrders: {
    purchaseOrderId: string;
    purchaseOrderNumber: string;
    supplierOrganizationId: string;
    supplierOrganizationName: string;
    destinationWarehouseId: string;
    status: string;
    totalAmount: number;
    currency: string;
    items: { productId: string; productName: string; sku: string; quantity: number; unitPrice: number; lineTotal: number }[];
  }[];
  allocations: { purchaseOrderId?: string; supplierOrganizationName?: string; grossAmount?: number; providerFee?: number; commission?: number; supplierAmount?: number; currency?: string; settlementStatus?: string; note?: string }[];
}

interface CreateCheckoutRequest {
  supplierOrders: { supplierOrganizationId: string; destinationWarehouseId: string; items: { stockItemId: string; quantity: number; distributorOfferId?: string | null }[] }[];
}

@Injectable({ providedIn: 'root' })
export class CentralizedCheckoutService {
  private readonly http = inject(HttpClient);
  create(request: CreateCheckoutRequest, idempotencyKey: string): Observable<CheckoutResponse> {
    return this.http.post<CheckoutResponse>(API_ENDPOINTS.distributor.checkouts, request, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }

  initiatePayment(id: string, method: CheckoutPaymentMethod, idempotencyKey: string, phoneNumber?: string): Observable<CheckoutResponse> {
    const normalizedPhone = phoneNumber?.trim().replace(/[\s()-]/g, '').replace(/^\+/, '');
    const body = method === 'MPESA_SANDBOX'
      ? { method, phoneNumber: normalizedPhone }
      : { method };
    return this.http.post<CheckoutResponse>(API_ENDPOINTS.distributor.checkoutPayment(id), body, {
      headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }),
    });
  }

  get(id: string): Observable<CheckoutResponse> {
    return this.http.get<CheckoutResponse>(API_ENDPOINTS.distributor.checkout(id));
  }

  payment(id: string): Observable<CheckoutResponse['payment']> {
    return this.http.get<CheckoutResponse['payment']>(API_ENDPOINTS.distributor.checkoutPaymentState(id));
  }

  orders(id: string): Observable<CheckoutResponse['supplierOrders']> {
    return this.http.get<CheckoutResponse['supplierOrders']>(API_ENDPOINTS.distributor.checkoutOrders(id));
  }

  allocations(id: string): Observable<CheckoutResponse['allocations']> {
    return this.http.get<CheckoutResponse['allocations']>(API_ENDPOINTS.distributor.checkoutAllocations(id));
  }

  history(page = 0, size = 20): Observable<{ content: CheckoutResponse[] }> {
    return this.http.get<{ content: CheckoutResponse[] }>(API_ENDPOINTS.distributor.checkouts, {
      params: new HttpParams().set('page', page).set('size', size),
    });
  }

  cancel(id: string): Observable<CheckoutResponse> {
    return this.http.post<CheckoutResponse>(API_ENDPOINTS.distributor.checkoutCancel(id), {});
  }
}
