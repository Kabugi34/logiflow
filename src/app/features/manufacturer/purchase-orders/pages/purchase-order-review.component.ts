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
  protected readonly operationBusy = signal(false);
  protected readonly operationMessage = signal('');
  protected readonly pickedValues = signal<Record<string, number>>({});
  protected readonly packedValues = signal<Record<string, number>>({});
  protected readonly packageCount = signal(1);

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

  protected setLineValue(kind: 'picked' | 'packed', lineId: string | undefined, event: Event): void {
    if (!lineId) return;
    const quantity = Number((event.target as HTMLInputElement).value);
    (kind === 'picked' ? this.pickedValues : this.packedValues).update(rows => ({ ...rows, [lineId]: quantity }));
  }
  protected setPackageCount(event: Event): void { this.packageCount.set(Number((event.target as HTMLInputElement).value)); }
  protected hasMissingLineIds(lines: PurchaseOrderLine[]): boolean { return lines.some(line => !line.purchaseOrderItemId); }
  protected pickedValue(id: string, current: number): number { return Object.hasOwn(this.pickedValues(), id) ? this.pickedValues()[id] : current; }
  protected packedValue(id: string, current: number): number { return Object.hasOwn(this.packedValues(), id) ? this.packedValues()[id] : current; }

  protected retryFulfilment(): void {
    const order = this.order();
    if (!order || order.paymentStatus !== 'PAID' || order.fulfilmentStatus !== 'INVENTORY_EXCEPTION' || this.operationBusy()) return;
    this.operationBusy.set(true); this.operationMessage.set('');
    this.orderService.retryFulfilment(order.id).pipe(finalize(() => this.operationBusy.set(false))).subscribe({
      next: () => this.operationMessage.set('Fulfilment retry completed. Purchase order and inventory are refreshing from the backend.'),
      error: error => this.operationMessage.set(error?.error?.message ?? 'Fulfilment retry failed.'),
    });
  }

  protected savePick(lineId: string | undefined, currentPicked: number): void {
    const order = this.order(); if (!order || !lineId || this.operationBusy()) return;
    const quantity = this.pickedValues()[lineId] ?? currentPicked;
    this.operationBusy.set(true); this.operationMessage.set('');
    try { this.orderService.pickLine(order.id, lineId, quantity).pipe(finalize(() => this.operationBusy.set(false))).subscribe({
      next: () => this.operationMessage.set('Pick saved. Purchase-order lines and movement history are refreshing.'),
      error: error => this.operationMessage.set(error?.error?.message ?? 'Picking could not be saved.'),
    }); } catch (e) { this.operationBusy.set(false); this.operationMessage.set(e instanceof Error ? e.message : 'Picking could not be saved.'); }
  }

  protected savePacking(): void {
    const order = this.order(); if (!order || this.operationBusy()) return;
    const lines = order.lines.map(line => ({ purchaseOrderItemId: line.purchaseOrderItemId ?? '', packedQuantity: this.packedValues()[line.purchaseOrderItemId ?? ''] ?? line.packedQuantity }));
    this.operationBusy.set(true); this.operationMessage.set('');
    try { this.orderService.packOrder(order.id, this.packageCount(), lines).pipe(finalize(() => this.operationBusy.set(false))).subscribe({
      next: () => this.operationMessage.set('Packing saved. Fulfilment status is refreshing from the backend.'),
      error: error => this.operationMessage.set(error?.error?.message ?? 'Packing could not be saved.'),
    }); } catch (e) { this.operationBusy.set(false); this.operationMessage.set(e instanceof Error ? e.message : 'Packing could not be saved.'); }
  }
}
