import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, finalize, map, shareReplay, tap, throwError, timeout } from 'rxjs';
import { API_ENDPOINTS } from '../../core/api/api-endpoints';
import {
  normalizePaymentStatus,
  normalizePaymentTransactionStatus,
  PaymentInitiationRequest,
  PaymentInitiationResult,
  PaymentOrderType,
  PaymentStatus,
  PaymentTransaction,
  PaymentVerification,
} from '../../core/models/payment.model';

interface ApiPaymentTransaction {
  id?: string;
  paymentId?: string | null;
  paymentReference?: string | null;
  orderId: string;
  orderReference?: string | null;
  orderType: PaymentOrderType;
  direction: 'INCOMING' | 'OUTGOING';
  counterpartyName?: string | null;
  amount: number;
  currency: string;
  provider: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  reconciledAt?: string | null;
  reconciliationStatus?: string | null;
  reconciliationReference?: string | null;
  mpesaReceiptNumber?: string | null;
  failureReason?: string | null;
}

interface ApiPaymentPage {
  content?: ApiPaymentTransaction[];
}

interface ApiPaymentInitiation {
  paymentId: string;
  paymentReference?: string | null;
  provider?: string;
  customerMessage?: string | null;
}

interface ApiCustomerPaymentStatus {
  orderId: string;
  paymentId: string | null;
  status: string;
  amount: number;
  mpesaReceiptNumber: string | null;
  failureReason: string | null;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly records = signal<PaymentTransaction[]>([]);
  private readonly requests = new Map<string, Observable<PaymentInitiationResult>>();
  private readonly pendingOrders = new Set<string>();
  private historyRequestId = 0;
  readonly transactions = this.records.asReadonly();
  readonly loading = signal(false);
  readonly error = signal('');

  refreshTransactions(orderType: PaymentOrderType): void {
    const requestId = ++this.historyRequestId;
    this.loading.set(true);
    this.error.set('');
    this.fetchTransactions(orderType).subscribe({
      next: (rows) => {
        if (requestId !== this.historyRequestId) return;
        this.records.set(rows);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        if (requestId !== this.historyRequestId) return;
        this.error.set(
          this.errorMessage(error, 'Payment transactions could not be loaded from the API.'),
        );
        this.loading.set(false);
      },
    });
  }

  initiate(request: PaymentInitiationRequest): Observable<PaymentInitiationResult> {
    const orderId = request.orderId.trim();
    const phoneNumber = request.phoneNumber.trim();
    if (!orderId) {
      return throwError(() => new Error('An order reference is required to initiate payment.'));
    }
    if (!/^\+?[0-9]{9,15}$/.test(phoneNumber)) {
      return throwError(() => new Error('Enter a valid phone number in international format.'));
    }

    const requestKey = `${request.orderType}:${orderId}`;
    const activeRequest = this.requests.get(requestKey);
    if (activeRequest) return activeRequest;
    if (this.pendingOrders.has(requestKey)) {
      return throwError(
        () => new Error('A payment attempt is pending. Verify its status before retrying.'),
      );
    }

    const idempotencyKey = globalThis.crypto.randomUUID();
    const request$ = this.http
      .post<ApiPaymentInitiation>(
        API_ENDPOINTS.payments.initiate,
        {
          orderId,
          orderType: request.orderType,
          provider: request.provider,
          phoneNumber,
        },
        { headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }) },
      )
      .pipe(
        timeout({ first: 30_000 }),
        map((response) => {
          if (!response.paymentId?.trim()) {
            throw new Error('The payment service returned no payment reference.');
          }
          return {
            paymentId: response.paymentId,
            paymentReference: response.paymentReference ?? null,
            provider: response.provider ?? request.provider,
            customerMessage: response.customerMessage ?? null,
          };
        }),
        tap(() => this.pendingOrders.add(requestKey)),
        finalize(() => this.requests.delete(requestKey)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    this.requests.set(requestKey, request$);
    return request$;
  }

  verifyOrderPayment(
    orderType: PaymentOrderType,
    orderId: string,
  ): Observable<PaymentVerification> {
    if (orderType === 'CUSTOMER_ORDER') {
      return this.http
        .get<ApiCustomerPaymentStatus>(API_ENDPOINTS.distributor.paymentStatus(orderId))
        .pipe(
          map((response) => ({
            paymentExists: Boolean(response.paymentId),
            status: normalizePaymentStatus(response.status),
            failureReason: response.failureReason,
            mpesaReceiptNumber: response.mpesaReceiptNumber,
          })),
          tap((result) => this.updatePendingAttempt(orderType, orderId, result)),
        );
    }

    return this.fetchTransactions(orderType, orderId).pipe(
      map((transactions) => {
        const transaction = transactions[0];
        const result = transaction
          ? {
              paymentExists: true,
              status: normalizePaymentStatus(transaction.status),
              transaction,
              failureReason: transaction.failureReason,
              mpesaReceiptNumber: transaction.mpesaReceiptNumber,
            }
          : { paymentExists: false, status: 'UNKNOWN' as const };
        this.updatePendingAttempt(orderType, orderId, result);
        return result;
      }),
    );
  }

  private updatePendingAttempt(
    orderType: PaymentOrderType,
    orderId: string,
    verification: PaymentVerification,
  ): void {
    const key = `${orderType}:${orderId}`;
    if (
      !verification.paymentExists ||
      verification.status === 'PAID' ||
      verification.status === 'FAILED' ||
      verification.status === 'EXPIRED' ||
      verification.status === 'REVERSED' ||
      verification.status === 'REFUNDED'
    ) {
      this.pendingOrders.delete(key);
    } else {
      this.pendingOrders.add(key);
    }
  }

  private fetchTransactions(
    orderType: PaymentOrderType,
    orderId?: string,
  ): Observable<PaymentTransaction[]> {
    let params = new HttpParams().set('orderType', orderType);
    if (orderId) params = params.set('orderId', orderId);
    return this.http
      .get<ApiPaymentPage | ApiPaymentTransaction[]>(API_ENDPOINTS.payments.transactions, {
        params,
      })
      .pipe(
        map((result) => {
          const rows = Array.isArray(result) ? result : result.content;
          if (!rows) throw new Error('The payment service returned an invalid transaction list.');
          return rows.map((row) => this.mapTransaction(row));
        }),
        map((rows) => rows.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))),
      );
  }

  private mapTransaction(row: ApiPaymentTransaction): PaymentTransaction {
    if (
      !(row.id ?? row.paymentId)?.trim() ||
      !row.orderId?.trim() ||
      !['PURCHASE_ORDER', 'CUSTOMER_ORDER'].includes(row.orderType) ||
      !['INCOMING', 'OUTGOING'].includes(row.direction) ||
      !Number.isFinite(row.amount) ||
      row.amount < 0 ||
      !row.currency?.trim() ||
      !row.provider?.trim() ||
      !row.createdAt?.trim() ||
      !row.updatedAt?.trim()
    ) {
      throw new Error('The payment service returned an incomplete transaction record.');
    }
    return {
      id: row.id ?? row.paymentId!,
      paymentReference: row.paymentReference?.trim() || row.paymentId!,
      orderId: row.orderId,
      orderReference: row.orderReference?.trim() || row.orderId,
      orderType: row.orderType,
      direction: row.direction,
      counterpartyName: row.counterpartyName?.trim() || '—',
      amount: row.amount,
      currency: row.currency,
      provider: row.provider,
      status: normalizePaymentTransactionStatus(row.status),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt || row.createdAt,
      reconciledAt: row.reconciledAt ?? null,
      reconciliationStatus: row.reconciliationStatus?.trim() || 'UNKNOWN',
      reconciliationReference: row.reconciliationReference ?? null,
      mpesaReceiptNumber: row.mpesaReceiptNumber ?? null,
      failureReason: row.failureReason ?? null,
    };
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      typeof error.error === 'object' &&
      error.error !== null &&
      'message' in error.error &&
      typeof error.error.message === 'string'
    ) {
      return error.error.message;
    }
    return error instanceof Error ? error.message : fallback;
  }
}
