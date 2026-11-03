import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TimeoutError } from 'rxjs';
import {
  normalizePaymentStatus,
  normalizePaymentTransactionStatus,
  PaymentOrderType,
  PaymentStatus,
  PaymentTransactionStatus,
} from '../../core/models/payment.model';
import { trimmedRequired } from '../../core/forms/form-validators';
import { PaymentService } from './payment.service';

@Component({
  selector: 'app-payment-initiation',
  standalone: true,
  imports: [CurrencyPipe, ReactiveFormsModule],
  template: `
    <section class="rounded-lg border border-slate-200 bg-white p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-slate-900">M-Pesa payment</h2>
          <p class="mt-1 text-xs text-slate-500">
            Payment is complete only after the backend verifies the provider callback.
          </p>
          @if (amount() !== null) {
            <p class="mt-1 text-xs font-medium text-slate-700">
              Order amount: {{ amount() | currency: currency() : 'symbol' : '1.0-2' }}
            </p>
          }
        </div>
        <span
          class="rounded border px-2 py-1 text-[10px] font-semibold"
          [class.border-emerald-200]="status() === 'SUCCEEDED'"
          [class.bg-emerald-50]="status() === 'SUCCEEDED'"
          [class.text-emerald-700]="status() === 'SUCCEEDED'"
          [class.border-amber-200]="status() === 'PENDING' || status() === 'UNKNOWN'"
          [class.bg-amber-50]="status() === 'PENDING' || status() === 'UNKNOWN'"
          [class.text-amber-700]="status() === 'PENDING' || status() === 'UNKNOWN'"
          [class.border-red-200]="status() === 'FAILED' || status() === 'EXPIRED'"
          [class.bg-red-50]="status() === 'FAILED' || status() === 'EXPIRED'"
          [class.text-red-700]="status() === 'FAILED' || status() === 'EXPIRED'"
          [class.border-slate-200]="status() === 'REVERSED' || status() === 'REFUNDED'"
          [class.bg-slate-50]="status() === 'REVERSED' || status() === 'REFUNDED'"
          [class.text-slate-600]="status() === 'REVERSED' || status() === 'REFUNDED'"
          >{{ status() }}</span
        >
      </div>

      @if (paymentReference()) {
        <p class="mt-3 text-xs text-slate-600">
          Payment reference: <span class="font-medium">{{ paymentReference() }}</span>
        </p>
      }
      @if (mpesaReceiptNumber()) {
        <p class="mt-1 text-xs text-slate-600">
          M-Pesa receipt: <span class="font-medium">{{ mpesaReceiptNumber() }}</span>
        </p>
      }
      @if (message()) {
        <p role="status" class="mt-3 rounded bg-blue-50 px-3 py-2 text-xs text-blue-800">
          {{ message() }}
        </p>
      }
      @if (error()) {
        <p role="alert" class="mt-3 rounded bg-red-50 px-3 py-2 text-xs text-red-700">
          {{ error() }}
        </p>
      }

      @if (status() !== 'SUCCEEDED') {
        @if (status() === 'PENDING' || status() === 'UNKNOWN' || verificationRequired()) {
          <button
            type="button"
            class="mt-3 rounded border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 disabled:opacity-50"
            [disabled]="busy()"
            (click)="verify()"
          >
            {{ busy() ? 'Checking…' : 'Check payment status' }}
          </button>
        }

        @if (canInitiate()) {
          <form [formGroup]="form" (ngSubmit)="submit()" class="mt-4 flex flex-wrap gap-2">
            <label class="min-w-52 flex-1">
              <span class="mb-1 block text-[10px] font-medium text-slate-600"
                >Customer or payer phone</span
              >
              <input
                type="tel"
                formControlName="phoneNumber"
                autocomplete="tel"
                placeholder="+2547XXXXXXXX"
                class="h-9 w-full rounded border border-slate-300 px-3 text-xs"
              />
            </label>
            <button
              type="submit"
              [disabled]="busy()"
              class="mt-auto h-9 rounded bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
            >
              {{
                busy()
                  ? 'Sending…'
                  : status() === 'FAILED' || status() === 'EXPIRED'
                    ? 'Retry M-Pesa prompt'
                    : 'Send M-Pesa prompt'
              }}
            </button>
          </form>
          @if (form.controls.phoneNumber.touched && form.controls.phoneNumber.invalid) {
            <p class="mt-1 text-[10px] text-red-700">
              Enter a phone number with 9–15 digits, optionally prefixed with +.
            </p>
          }
        } @else if (status() === 'PENDING') {
          <p class="mt-3 text-xs text-amber-700">
            A payment is pending. Check its server-verified status before starting another attempt.
          </p>
        } @else if (status() === 'UNKNOWN' && !verificationRequired()) {
          <p class="mt-3 text-xs text-slate-600">
            Verify the current payment state before starting a new payment attempt.
          </p>
        } @else if (status() === 'REVERSED' || status() === 'REFUNDED') {
          <p class="mt-3 text-xs text-slate-600">
            A reversed or refunded payment cannot be retried from this screen.
          </p>
        }
      }
    </section>
  `,
})
export class PaymentInitiationComponent {
  readonly orderId = input.required<string>();
  readonly orderType = input.required<PaymentOrderType>();
  readonly initialStatus = input.required<PaymentStatus>();
  readonly amount = input<number | null>(null);
  readonly currency = input('KES');
  readonly canInitiatePayment = input(false);
  readonly verifiedStatus = output<PaymentStatus>();

  private readonly fb = inject(FormBuilder);
  private readonly paymentService = inject(PaymentService);
  protected readonly status = signal<PaymentTransactionStatus>('UNKNOWN');
  protected readonly paymentExists = signal<boolean | null>(null);
  protected readonly busy = signal(false);
  protected readonly verificationRequired = signal(false);
  protected readonly message = signal('');
  protected readonly error = signal('');
  protected readonly paymentReference = signal('');
  protected readonly mpesaReceiptNumber = signal('');
  protected readonly canInitiate = computed(() => {
    if (!this.canInitiatePayment() || this.busy() || this.verificationRequired()) return false;
    if (this.status() === 'FAILED' || this.status() === 'EXPIRED') return true;
    return (
      (this.status() === 'PENDING' || this.status() === 'UNKNOWN') && this.paymentExists() === false
    );
  });
  protected readonly form = this.fb.nonNullable.group({
    phoneNumber: [
      '',
      [trimmedRequired, Validators.pattern(/^\+?[0-9]{9,15}$/), Validators.maxLength(16)],
    ],
  });

  constructor() {
    effect(() => {
      this.status.set(normalizePaymentTransactionStatus(this.initialStatus()));
    });
  }

  protected submit(): void {
    if (!this.canInitiate()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    this.paymentService
      .initiate({
        orderId: this.orderId(),
        orderType: this.orderType(),
        provider: 'MPESA',
        phoneNumber: this.form.getRawValue().phoneNumber,
      })
      .subscribe({
        next: (result) => {
          this.busy.set(false);
          this.paymentExists.set(true);
          this.status.set('PENDING');
          this.verificationRequired.set(true);
          this.paymentReference.set(result.paymentReference ?? result.paymentId);
          this.message.set(
            result.customerMessage ??
              'Payment request submitted. Waiting for backend/provider reconciliation.',
          );
        },
        error: (error: unknown) => {
          this.busy.set(false);
          this.verificationRequired.set(true);
          this.error.set(
            error instanceof TimeoutError
              ? 'Payment request timed out. Check the backend status before retrying.'
              : error instanceof Error
                ? error.message
                : 'Payment request failed. Check payment status before retrying.',
          );
        },
      });
  }

  protected verify(): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    this.paymentService.verifyOrderPayment(this.orderType(), this.orderId()).subscribe({
      next: (result) => {
        this.busy.set(false);
        this.status.set(normalizePaymentTransactionStatus(result.status));
        this.paymentExists.set(result.paymentExists);
        this.verificationRequired.set(false);
        this.paymentReference.set(
          result.transaction?.paymentReference ?? result.transaction?.id ?? '',
        );
        this.mpesaReceiptNumber.set(
          result.mpesaReceiptNumber ?? result.transaction?.mpesaReceiptNumber ?? '',
        );
        this.message.set(
          result.failureReason ??
            (result.paymentExists
              ? 'Status refreshed from the payment service.'
              : 'No payment attempt is recorded for this order.'),
        );
        this.verifiedStatus.emit(result.status);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.verificationRequired.set(true);
        this.error.set(
          error instanceof Error
            ? error.message
            : 'Payment status could not be verified. No payment state was changed.',
        );
      },
    });
  }
}
