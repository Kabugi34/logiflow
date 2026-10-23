import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ManufacturerDashboardService } from '../dashboard.service';
import { DashboardStatisticsComponent } from '../components/dashboard-statistics/dashboard-statistics.component';
import { PendingPurchaseOrdersComponent } from '../components/pending-purchase-orders/pending-purchase-orders.component';
import { ActiveShipmentsComponent } from '../components/active-shipments/active-shipments.component';
import { LiveFleetMapComponent } from '../components/live-fleet-map/live-fleet-map.component';
import { FleetOverviewComponent } from '../components/fleet-overview/fleet-overview.component';
import { AttentionPanelComponent } from '../components/attention-panel/attention-panel.component';
import { LoadingSkeletonComponent } from '../../../../shared/loading/loading-skeleton.component';

@Component({
  selector: 'app-manufacturer-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    LoadingSkeletonComponent,
    DashboardStatisticsComponent,
    PendingPurchaseOrdersComponent,
    ActiveShipmentsComponent,
    LiveFleetMapComponent,
    FleetOverviewComponent,
    AttentionPanelComponent
  ],
  templateUrl: './manufacturer-dashboard.component.html'
})
export class ManufacturerDashboardComponent {

  private readonly dashboardService =
    inject(ManufacturerDashboardService);
  protected readonly loading = this.dashboardService.loading;

  get dashboard() { return this.dashboardService.getDashboard(); }

  purchaseOrders =
    this.dashboardService.getPendingPurchaseOrders();

  shipments =
    this.dashboardService.getActiveShipments();

  drivers = this.dashboardService.getFleetDrivers();

  attentionItems = this.dashboardService.getAttentionItems();
}
