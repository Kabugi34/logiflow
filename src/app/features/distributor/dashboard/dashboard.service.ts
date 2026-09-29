import { computed, inject, Injectable } from '@angular/core';
import { DistributorFleetService } from '../fleet/fleet.service';
import { DistributorInventoryService } from '../inventory/inventory.service';
import { DistributorOrderService } from '../orders/order.service';
import {
  DashboardCustomerOrder,
  DashboardFleetDriver,
  DashboardStockAlert,
  DashboardVehicle,
  DistributorDashboard
} from './dashboard.models';

@Injectable({
  providedIn: 'root'
})
export class DistributorDashboardService {
  private readonly orderService = inject(DistributorOrderService);
  private readonly inventoryService = inject(DistributorInventoryService);
  private readonly fleetService = inject(DistributorFleetService);

  readonly activeOrders = computed<DashboardCustomerOrder[]>(() => this.orderService.activeOrders().map(order => ({
    id: order.id,
    customerName: order.customerName,
    itemSummary: this.orderService.itemSummary(order),
    total: this.orderService.total(order),
    status: order.status
  })));

  readonly stockAlerts = computed<DashboardStockAlert[]>(() => this.inventoryService.thresholdAlerts().map(item => ({
    sku: item.sku,
    name: item.name,
    onHand: item.onHand,
    unit: item.unit,
    level: this.inventoryService.stockLevel(item) === 'CRITICAL' ? 'CRITICAL' : 'LOW'
  })));

  readonly vehicles = computed<DashboardVehicle[]>(() => this.fleetService.vehicles()
    .filter(vehicle => vehicle.status !== 'MAINTENANCE')
    .map(vehicle => ({
      id: vehicle.id,
      model: vehicle.model,
      status: vehicle.status === 'ON_TRIP' ? 'ON_TRIP' : 'AVAILABLE',
      locationLabel: vehicle.locationLabel,
      latitude: vehicle.latitude,
      longitude: vehicle.longitude
    })));

  readonly drivers = computed<DashboardFleetDriver[]>(() => this.fleetService.drivers().map(driver => ({
    id: driver.id,
    name: driver.name,
    status: driver.status,
    vehicleModel: this.fleetService.findVehicle(driver.vehicleId)?.model,
    orderId: driver.currentOrderId,
    locationLabel: driver.locationLabel
  })));

  getDashboard(): DistributorDashboard {
    return {
      customerOrdersToday: 382,
      pendingOrders: 12,
      shippedOrders: 320,
      paidOrders: 50,
      inventoryValue: 2840000,
      inventoryUnits: 45910,
      inventoryCategories: 14,
      incomingPurchaseOrders: 12,
      incomingPurchaseOrderValue: 312400,
      supplyingManufacturers: 4,
      activeDeliveryTrips: 84,
      standbyDrivers: 19,
      completedTrips: 1240
    };
  }
}
