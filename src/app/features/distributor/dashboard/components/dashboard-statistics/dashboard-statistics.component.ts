import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { DistributorDashboard } from '../../dashboard.models';

@Component({
  selector: 'app-distributor-dashboard-statistics',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe],
  templateUrl: './dashboard-statistics.component.html'
})
export class DashboardStatisticsComponent {
  readonly dashboard = input.required<DistributorDashboard>();
}
