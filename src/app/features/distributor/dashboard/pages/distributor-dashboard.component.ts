import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DistributorDashboardService } from '../dashboard.service';
import { DashboardStatisticsComponent } from '../components/dashboard-statistics/dashboard-statistics.component';
import { ActiveCustomerOrdersComponent } from '../components/active-customer-orders/active-customer-orders.component';
import { CriticalStockComponent } from '../components/critical-stock/critical-stock.component';
import { FleetMapComponent } from '../components/fleet-map/fleet-map.component';
import { FleetOverviewComponent } from '../components/fleet-overview/fleet-overview.component';

@Component({
  selector: 'app-distributor-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    DashboardStatisticsComponent,
    ActiveCustomerOrdersComponent,
    CriticalStockComponent,
    FleetMapComponent,
    FleetOverviewComponent
  ],
  templateUrl: './distributor-dashboard.component.html'
})
export class DistributorDashboardComponent {

  private readonly dashboardService =
    inject(DistributorDashboardService);

  dashboard = this.dashboardService.getDashboard();

  activeOrders = this.dashboardService.activeOrders;

  stockAlerts = this.dashboardService.stockAlerts;

  vehicles = this.dashboardService.vehicles;

  drivers = this.dashboardService.drivers;
}
