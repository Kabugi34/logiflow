import { Injectable } from '@angular/core';
import {
  DashboardPurchaseOrder,
  DashboardAttentionItem,
  DashboardDriver,
  DashboardShipment,
  ManufacturerDashboard
} from './dashboard.models';

@Injectable({
  providedIn: 'root'
})
export class ManufacturerDashboardService {

  getDashboard(): ManufacturerDashboard {
    return {
      activeDispatchFleet: 14892,
      activeDrivers: 84,
      availableDrivers: 19,
      activeShipments: 382,
      delayedShipments: 4,
      pendingPurchaseOrders: 24,
      pendingPurchaseOrderValue: 182400,
      deliveriesToday: 1240,
      deliveriesOnTrackPercentage: 98.2
    };
  }

  getPendingPurchaseOrders(): DashboardPurchaseOrder[] {
    return [
      {
        id: 1,
        orderNumber: 'PO-2024-09A',
        distributorName: 'Apex Distributor Corp',
        itemSummary: '140 Heavy Motors',
        totalAmount: 42500,
        status: 'PENDING'
      },
      {
        id: 2,
        orderNumber: 'PO-2024-09B',
        distributorName: 'InterState Supply Ltd',
        itemSummary: '80 Gear Assemblies',
        totalAmount: 18200,
        status: 'PENDING'
      },
      {
        id: 3,
        orderNumber: 'PO-2024-09C',
        distributorName: 'VoltLine Grid Solutions',
        itemSummary: '300 Volt Regulators',
        totalAmount: 11200,
        status: 'PENDING'
      }
    ];
  }

  getActiveShipments(): DashboardShipment[] {
    return [
      {
        id: 1,
        shipmentNumber: 'TRK-09214',
        destination: 'Chicago Hub → New York Port',
        driverName: 'Alex Mercer',
        tripNumber: 'TR-442',
        status: 'DELIVERED',
        eta: '14:00'
      },
      {
        id: 2,
        shipmentNumber: 'TRK-88104',
        destination: 'L.A. Terminal → Houston Depot',
        driverName: 'Sarah Connor',
        tripNumber: 'Delayed at Border Check',
        status: 'DELAYED',
        eta: '16:30'
      },
      {
        id: 3,
        shipmentNumber: 'TRK-3291',
        destination: 'Vancouver Port → Calgary Terminal',
        driverName: 'David Jenkins',
        tripNumber: 'Customs Hold Exception',
        status: 'EXCEPTION'
      }
    ];
  }

  getFleetDrivers(): DashboardDriver[] {
    return [
      {
        id: 1,
        name: 'Alex Mercer',
        vehicle: 'Kenworth T680 (Plate: 409-TDX)',
        status: 'ACTIVE',
        route: 'Route #A42',
        latitude: 41.8781,
        longitude: -87.6298
      },
      {
        id: 2,
        name: 'Sarah Connor',
        vehicle: 'Peterbilt 579 (Plate: 812-OKL)',
        status: 'ACTIVE',
        route: 'Route #B09',
        latitude: 29.7604,
        longitude: -95.3698
      },
      {
        id: 3,
        name: 'David Jenkins',
        vehicle: 'Freightliner (Plate: 556-WQE)',
        status: 'STANDBY',
        route: 'Yard #Chicago',
        latitude: 41.9012,
        longitude: -87.6585
      }
    ];
  }

  getAttentionItems(): DashboardAttentionItem[] {
    return [
      {
        id: 1,
        title: 'Delayed route hold',
        description: 'TRK-88104 is delayed at the border check.',
        severity: 'WARNING',
        actionLabel: 'Review shipment',
        route: '/manufacturer/shipments'
      },
      {
        id: 2,
        title: 'Customs exception',
        description: 'TRK-3291 needs customs documentation review.',
        severity: 'CRITICAL',
        actionLabel: 'Open shipment',
        route: '/manufacturer/shipments'
      },
      {
        id: 3,
        title: 'Critical stock level',
        description: 'Pneumatic Control Valve has only 14 units on hand.',
        severity: 'CRITICAL',
        actionLabel: 'View catalog',
        route: '/manufacturer/products/PCV-404-Z'
      }
    ];
  }
}