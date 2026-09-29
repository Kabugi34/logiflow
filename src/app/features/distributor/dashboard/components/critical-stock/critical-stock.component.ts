import { Component, input } from '@angular/core';
import { DashboardStockAlert } from '../../dashboard.models';

@Component({
  selector: 'app-critical-stock',
  standalone: true,
  templateUrl: './critical-stock.component.html'
})
export class CriticalStockComponent {
  readonly alerts = input.required<DashboardStockAlert[]>();
}
