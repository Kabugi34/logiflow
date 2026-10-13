import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DistributorProcurementService } from '../procurement.service';

@Component({
  selector: 'app-purchase-order-details',
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink],
  templateUrl: './purchase-order-details.component.html'
})
export class PurchaseOrderDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly routeParams = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });
  protected readonly procurement = inject(DistributorProcurementService);
  protected readonly order = computed(() => this.procurement.findOrder(this.routeParams().get('id') ?? ''));

  protected timelineClass(state: 'COMPLETE' | 'CURRENT' | 'UPCOMING'): string {
    switch (state) {
      case 'COMPLETE': return 'bg-emerald-500';
      case 'CURRENT': return 'bg-blue-600';
      case 'UPCOMING': return 'bg-slate-300';
    }
  }
}