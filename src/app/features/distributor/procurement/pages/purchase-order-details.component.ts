import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { effect, signal } from '@angular/core';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { downloadPurchaseOrderPdf } from '../purchase-order-pdf';
import { DistributorProcurementService } from '../procurement.service';
import { PaymentInitiationComponent } from '../../../payments/payment-initiation.component';
import { AuthService } from '../../../../core/auth/auth.service';
import { PaymentStatus } from '../../../../core/models/payment.model';
import {
  hasAwaitingBankPayment,
  isPartiallyPaid,
  PROOF_ACCEPT,
  proofFileError,
  PurchaseOrderSettlement,
} from '../../../../core/models/purchase-order-settlement.model';

function newIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

@Component({
  selector: 'app-purchase-order-details',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, PaymentInitiationComponent],
  templateUrl: './purchase-order-details.component.html',
})
export class PurchaseOrderDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly routeParams = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  protected readonly procurement = inject(DistributorProcurementService);
  private readonly auth = inject(AuthService);
  protected readonly order = computed(() =>
    this.procurement.findOrder(this.routeParams().get('id') ?? ''),
  );
  protected readonly settlements = signal<PurchaseOrderSettlement[]>([]);
  protected readonly proofAccept = PROOF_ACCEPT;
  protected readonly bankReference = signal('');
  protected readonly proofFile = signal<File | null>(null);
  protected readonly bankError = signal('');
  protected readonly bankNotice = signal('');
  protected readonly submittingBank = signal(false);
  /** Reused if the same submission is retried, so a double click or retry cannot record two slips. */
  private bankIdempotencyKey = newIdempotencyKey();
  protected readonly awaitingConfirmation = computed(() =>
    hasAwaitingBankPayment(this.settlements()),
  );
  protected readonly partiallyPaid = computed(() =>
    this.settlements().some((settlement) => isPartiallyPaid(settlement)),
  );
  protected readonly exportError = signal('');
  protected readonly canInitiatePayment = computed(
    () => this.auth.hasRole('DISTRIBUTOR_ADMIN') || this.auth.hasRole('DISTRIBUTOR_STAFF'),
  );

  constructor() {
    effect(() => {
      const id = this.routeParams().get('id');
      if (id) {
        this.procurement.loadOrder(id);
        this.reloadSettlements(id);
      }
    });
  }

  private reloadSettlements(id: string): void {
    this.procurement
      .loadSettlements(id)
      .subscribe({ next: (rows) => this.settlements.set(rows) });
  }

  protected onProofSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.item(0) ?? null;
    this.proofFile.set(file);
    this.bankError.set(file ? proofFileError(file) : '');
  }

  protected submitBankTransfer(orderId: string): void {
    if (this.submittingBank() || !this.canInitiatePayment()) return;
    this.bankError.set('');
    this.bankNotice.set('');
    const reference = this.bankReference().trim();
    const file = this.proofFile();
    if (reference.length < 3) {
      this.bankError.set('Enter the bank transaction reference (at least 3 characters).');
      return;
    }
    const fileError = proofFileError(file);
    if (fileError || !file) {
      this.bankError.set(fileError);
      return;
    }
    this.submittingBank.set(true);
    this.procurement
      .submitBankTransfer(orderId, reference, file, this.bankIdempotencyKey)
      .pipe(finalize(() => this.submittingBank.set(false)))
      .subscribe({
        next: () => {
          this.bankNotice.set(
            'Proof submitted. The supplier will confirm the amount they received; your order is not paid until then.',
          );
          this.bankReference.set('');
          this.proofFile.set(null);
          this.bankIdempotencyKey = newIdempotencyKey();
          this.reloadSettlements(orderId);
        },
        error: (error) =>
          this.bankError.set(
            error?.error?.message ?? error?.message ?? 'The proof could not be submitted.',
          ),
      });
  }

  protected timelineClass(state: 'COMPLETE' | 'CURRENT' | 'UPCOMING'): string {
    switch (state) {
      case 'COMPLETE':
        return 'bg-emerald-500';
      case 'CURRENT':
        return 'bg-blue-600';
      case 'UPCOMING':
        return 'bg-slate-300';
    }
  }

  protected exportPdf(order: NonNullable<ReturnType<typeof this.order>>): void {
    this.exportError.set('');
    downloadPurchaseOrderPdf(order, this.procurement.total(order));
  }

  protected updatePaymentStatus(orderId: string, status: PaymentStatus): void {
    this.procurement.recordPaymentStatus(orderId, status);
  }
}
