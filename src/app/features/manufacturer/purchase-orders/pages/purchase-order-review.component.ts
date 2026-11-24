import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ManufacturerPurchaseOrderService } from '../purchase-order.service';
import { PurchaseOrderLine } from '../purchase-order.models';
import {
  hasAwaitingBankPayment,
  SettlementPayment,
} from '../../../../core/models/purchase-order-settlement.model';
import { PurchaseOrderStatusComponent } from '../components/purchase-order-status/purchase-order-status.component';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-purchase-order-review',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, PurchaseOrderStatusComponent],
  templateUrl: './purchase-order-review.component.html'
})
export class PurchaseOrderReviewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly orderService = inject(ManufacturerPurchaseOrderService);
  private readonly auth = inject(AuthService);
  private readonly routeParams = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly order = computed(() => this.orderService.findById(this.routeParams().get('id') ?? ''));
  protected readonly savingDecision = signal(false);
  protected readonly canReview = this.auth.hasRole('MANUFACTURER_ADMIN');
  /** Only the supplier's administrator may confirm money received; the API enforces this too. */
  protected readonly canConfirmPayments = this.auth.hasRole('MANUFACTURER_ADMIN');
  protected readonly amountInputs = signal<Record<string, string>>({});
  protected readonly confirmingPaymentId = signal<string | null>(null);
  protected readonly paymentError = signal('');
  protected readonly paymentNotice = signal('');
  protected readonly cancelling = signal(false);

  protected readonly payments = computed(() =>
    (this.order()?.settlements ?? [])
      .flatMap((settlement) => settlement.payments)
      .sort((a, b) => Date.parse(a.submittedAt) - Date.parse(b.submittedAt)),
  );
  protected readonly hasAwaitingPayment = computed(() =>
    hasAwaitingBankPayment(this.order()?.settlements ?? []),
  );
  protected readonly canCancelOverdue = computed(() => {
    const order = this.order();
    return (
      this.canReview &&
      !!order &&
      order.overdue &&
      order.status === 'ACCEPTED' &&
      order.amountPaid === 0 &&
      !this.payments().length
    );
  });

  protected amountFor(paymentId: string): string {
    const typed = this.amountInputs()[paymentId];
    if (typed !== undefined) return typed;
    const order = this.order();
    // A pay-now order must be received in full, so offer the exact total.
    return order && order.paymentTerms === 'PAY_NOW' ? order.totalAmount.toFixed(2) : '';
  }

  protected setAmount(paymentId: string, value: string): void {
    this.amountInputs.update((current) => ({ ...current, [paymentId]: value }));
  }

  protected confirmPayment(payment: SettlementPayment): void {
    const order = this.order();
    if (!order || !this.canConfirmPayments || this.confirmingPaymentId()) return;
    this.paymentError.set('');
    this.paymentNotice.set('');
    const amountText = this.amountFor(payment.id).trim();
    const amount = Number(amountText);
    if (!/^\d+(\.\d{1,2})?$/.test(amountText) || !Number.isFinite(amount) || amount <= 0) {
      this.paymentError.set('Enter the amount received, up to two decimal places.');
      return;
    }
    this.confirmingPaymentId.set(payment.id);
    this.orderService
      .confirmBankPayment(order.id, payment.payerReference, amount)
      .pipe(finalize(() => this.confirmingPaymentId.set(null)))
      .subscribe({
        next: () => this.paymentNotice.set(`Payment ${payment.payerReference} confirmed.`),
        error: (error) =>
          this.paymentError.set(
            error?.error?.message ?? 'The payment could not be confirmed. Check the amount received.',
          ),
      });
  }

  protected viewProof(payment: SettlementPayment): void {
    const order = this.order();
    if (!order || !payment.proofDocumentId) return;
    this.paymentError.set('');
    this.orderService.downloadProof(order.id, payment.proofDocumentId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `payment-proof-${payment.payerReference}`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => this.paymentError.set('The payment proof could not be downloaded.'),
    });
  }

  protected cancelOverdue(): void {
    const order = this.order();
    if (!order || !this.canCancelOverdue() || this.cancelling()) return;
    const confirmed = globalThis.confirm(
      'Cancel this overdue credit order? Its reserved stock will be released.',
    );
    if (!confirmed) return;
    this.cancelling.set(true);
    this.paymentError.set('');
    this.orderService
      .cancelOverdue(order.id)
      .pipe(finalize(() => this.cancelling.set(false)))
      .subscribe({
        next: () => this.paymentNotice.set('The overdue order was cancelled.'),
        error: (error) =>
          this.paymentError.set(error?.error?.message ?? 'The order could not be cancelled.'),
      });
  }

  protected totalValue(lines: PurchaseOrderLine[]): number {
    return lines.reduce((sum, line) => sum + line.requestedQuantity * line.unitPrice, 0);
  }

  protected acceptAndGenerateManifest(): void {
    const order = this.order();
    if (!order || order.status !== 'PENDING' || this.savingDecision()) return;
    this.savingDecision.set(true);
    if (!this.canReview) return;
    this.orderService.updateStatus(order.id, 'ACCEPTED').pipe(finalize(() => this.savingDecision.set(false))).subscribe({
      next: () => void this.router.navigate(['/manufacturer/purchase-orders'], { queryParamsHandling: 'preserve' }),
      error: () => this.orderService.error.set('The purchase order could not be approved.'),
    });
  }

  protected rejectOrder(): void {
    const order = this.order();
    if (!order || order.status !== 'PENDING' || this.savingDecision()) return;
    if (!this.canReview) return;
    const note = globalThis.prompt('Provide a reason for rejecting this purchase order:')?.trim();
    if (!note) return;
    this.savingDecision.set(true);
    this.orderService.updateStatus(order.id, 'REJECTED', note).pipe(finalize(() => this.savingDecision.set(false))).subscribe({
      next: () => void this.router.navigate(['/manufacturer/purchase-orders'], { queryParamsHandling: 'preserve' }),
      error: () => this.orderService.error.set('The purchase order could not be rejected.'),
    });
  }
}
