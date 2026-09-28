import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { ManufacturerDashboard } from '../../dashboard.models';

@Component({
  selector: 'app-dashboard-statistics',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe],
  templateUrl: './dashboard-statistics.component.html'
})
export class DashboardStatisticsComponent {
  readonly dashboard = input.required<ManufacturerDashboard>();
}
