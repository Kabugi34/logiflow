import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { ManufacturerPurchaseOrderService } from '../purchase-order.service';
import { PurchaseOrderLine } from '../purchase-order.models';
import { PurchaseOrderStatusComponent } from '../components/purchase-order-status/purchase-order-status.component';

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
  private readonly routeParams = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly order = computed(() => this.orderService.findById(this.routeParams().get('id') ?? ''));

  protected totalValue(lines: PurchaseOrderLine[]): number {
    return lines.reduce((sum, line) => sum + line.requestedQuantity * line.unitPrice, 0);
  }

  protected acceptAndGenerateManifest(): void {
    const order = this.order();
    if (!order || order.status !== 'PENDING') return;
    this.orderService.updateStatus(order.id, 'FULFILLED');
    void this.router.navigate(['/manufacturer/purchase-orders'], { queryParamsHandling: 'preserve' });
  }

  protected rejectOrder(): void {
    const order = this.order();
    if (!order || order.status !== 'PENDING') return;
    this.orderService.updateStatus(order.id, 'REJECTED');
    void this.router.navigate(['/manufacturer/purchase-orders'], { queryParamsHandling: 'preserve' });
  }
}
