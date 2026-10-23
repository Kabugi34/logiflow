import { computed, inject, Injectable } from '@angular/core';
import { DistributorFleetService } from '../fleet/fleet.service';
import { DistributorInventoryService } from '../inventory/inventory.service';
import { DistributorOrderService } from '../orders/order.service';
import { DistributorProcurementService } from '../procurement/procurement.service';
import { DistributorTripService } from '../logistics/trip.service';
import {
  DashboardCustomerOrder,
  DashboardFleetDriver,
  DashboardStockAlert,
  DashboardVehicle,
  DistributorDashboard,
} from './dashboard.models';

@Injectable({
  providedIn: 'root',
})
export class DistributorDashboardService {
  private readonly orderService = inject(DistributorOrderService);
  private readonly inventoryService = inject(DistributorInventoryService);
  private readonly fleetService = inject(DistributorFleetService);
  private readonly procurementService = inject(DistributorProcurementService);
  private readonly tripService = inject(DistributorTripService);

  readonly activeOrders = computed<DashboardCustomerOrder[]>(() =>
    this.orderService.activeOrders().map((order) => ({
      id: order.id,
      customerName: order.customerName,
      itemSummary: this.orderService.itemSummary(order),
      total: this.orderService.total(order),
      status: order.status,
    })),
  );

  readonly stockAlerts = computed<DashboardStockAlert[]>(() =>
    this.inventoryService.thresholdAlerts().map((item) => ({
      sku: item.sku,
      name: item.name,
      onHand: item.onHand,
      unit: item.unit,
      level: this.inventoryService.stockLevel(item) === 'CRITICAL' ? 'CRITICAL' : 'LOW',
    })),
  );

  readonly vehicles = computed<DashboardVehicle[]>(() =>
    this.fleetService
      .vehicles()
      .filter((vehicle) => vehicle.status !== 'MAINTENANCE')
      .map((vehicle) => ({
        id: vehicle.id,
        model: vehicle.model,
        status: vehicle.status === 'ON_TRIP' ? 'ON_TRIP' : 'AVAILABLE',
        locationLabel: vehicle.locationLabel,
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
      })),
  );

  readonly drivers = computed<DashboardFleetDriver[]>(() =>
    this.fleetService
      .drivers()
      .filter((driver) => driver.accountStatus === 'ACTIVE')
      .map((driver) => ({
        id: driver.id,
        name: driver.name,
        status: driver.status,
        vehicleModel: this.fleetService.findVehicle(driver.vehicleId)?.model,
        orderId: driver.currentOrderId,
        locationLabel: driver.locationLabel,
      })),
  );

  getDashboard(): DistributorDashboard {
    return {
      customerOrdersToday: this.orderService
        .orders()
        .filter((order) => new Date(order.orderDate).toDateString() === new Date().toDateString())
        .length,
      pendingOrders: this.orderService
        .orders()
        .filter((order) =>
          ['PENDING', 'CONFIRMED', 'PROCESSING', 'AWAITING_DISPATCH'].includes(order.status),
        ).length,
      shippedOrders: this.orderService.orders().filter((order) => order.status === 'IN_TRANSIT')
        .length,
      paidOrders: this.orderService.orders().filter((order) => order.paymentStatus === 'PAID')
        .length,
      inventoryValue: this.inventoryService
        .items()
        .reduce((total, item) => total + item.onHand * item.unitPrice, 0),
      inventoryUnits: this.inventoryService.items().reduce((total, item) => total + item.onHand, 0),
      inventoryCategories: new Set(this.inventoryService.items().map((item) => item.category)).size,
      incomingPurchaseOrders: this.procurementService
        .orders()
        .filter((order) => order.status === 'PENDING').length,
      incomingPurchaseOrderValue: this.procurementService
        .orders()
        .filter((order) => order.status === 'PENDING')
        .reduce((sum, order) => sum + this.procurementService.total(order), 0),
      supplyingManufacturers: this.procurementService.manufacturers().length,
      activeDeliveryTrips: this.tripService.activeTrips().length,
      standbyDrivers: this.fleetService.standbyDrivers().length,
      completedTrips: this.tripService.trips().filter((trip) => trip.status === 'COMPLETED').length,
    };
  }
}
