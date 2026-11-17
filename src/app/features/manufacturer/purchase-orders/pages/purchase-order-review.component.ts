import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ManufacturerPurchaseOrderService } from '../purchase-order.service';
import { PurchaseOrderLine } from '../purchase-order.models';
import { PurchaseOrderStatusComponent } from '../components/purchase-order-status/purchase-order-status.component';
import { finalize } from 'rxjs';
import { AuthService } from '../../../../core/auth/auth.service';

@Component({
  selector: 'app-purchase-order-review',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, RouterLink, PurchaseOrderStatusComponent],
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
