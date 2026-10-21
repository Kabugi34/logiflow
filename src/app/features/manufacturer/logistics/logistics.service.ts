import { computed, inject, Injectable } from '@angular/core';
import { ManufacturerShipmentService } from '../shipments/shipment.service';
import { ManufacturerFleetService } from '../fleet/fleet.service';
import { LogisticsTrip, LogisticsTripStatus } from './logistics.models';

@Injectable({ providedIn: 'root' })
export class ManufacturerLogisticsService {
  private readonly shipmentService = inject(ManufacturerShipmentService);
  private readonly fleetService = inject(ManufacturerFleetService);

  readonly trips = computed<LogisticsTrip[]>(() => this.shipmentService.shipments().map(shipment => {
    const progress = { totalStops: shipment.route.length, completedStops: 0, currentLocation: shipment.route[0]?.label ?? '—' };
    const status: LogisticsTripStatus = shipment.status === 'BORDER_HOLD' ? 'DELAYED' : shipment.status;
    const driver = this.fleetService.drivers().find(record => record.currentTripId === shipment.tripId);
    const vehicle = driver?.vehicleId ? this.fleetService.findVehicle(driver.vehicleId) : undefined;
    return {
      id: shipment.tripId,
      driver: driver?.name ?? shipment.assignedDriver,
      vehicle: vehicle?.type ?? shipment.vehicle,
      shipmentIds: [shipment.id],
      totalStops: progress.totalStops,
      completedStops: progress.completedStops,
      status,
      currentLocation: progress.currentLocation,
      route: shipment.route
    };
  }));

  readonly metrics = computed(() => {
    const trips = this.trips();
    return {
      activeTrips: trips.length,
      availableDrivers: this.fleetService.drivers().filter(driver => driver.status === 'STANDBY').length,
      delayedTrips: trips.filter(trip => trip.status === 'DELAYED').length
    };
  });

  findTripById(id: string): LogisticsTrip | undefined {
    return this.trips().find(trip => trip.id === id);
  }
}
