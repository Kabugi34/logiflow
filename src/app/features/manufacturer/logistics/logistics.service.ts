import { computed, inject, Injectable } from '@angular/core';
import { ManufacturerShipmentService } from '../shipments/shipment.service';
import { ManufacturerFleetService } from '../fleet/fleet.service';
import { LogisticsTrip, LogisticsTripStatus } from './logistics.models';

const tripProgress: Record<string, { totalStops: number; completedStops: number; currentLocation: string }> = {
  'TRP-8012': { totalStops: 4, completedStops: 1, currentLocation: 'Voi, Taita-Taveta' },
  'TRP-8010': { totalStops: 2, completedStops: 2, currentLocation: 'Nairobi Industrial Area' },
  'TRP-8015': { totalStops: 6, completedStops: 2, currentLocation: 'Nakuru Highway Checkpoint' },
  'TRP-8016': { totalStops: 3, completedStops: 0, currentLocation: 'Naivasha, Nakuru County' }
};

@Injectable({ providedIn: 'root' })
export class ManufacturerLogisticsService {
  private readonly shipmentService = inject(ManufacturerShipmentService);
  private readonly fleetService = inject(ManufacturerFleetService);

  readonly trips = computed<LogisticsTrip[]>(() => this.shipmentService.shipments().map(shipment => {
    const progress = tripProgress[shipment.tripId] ?? { totalStops: 4, completedStops: 0, currentLocation: shipment.route[0]?.label ?? 'Unknown' };
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
      availableDrivers: 19,
      delayedTrips: trips.filter(trip => trip.status === 'DELAYED').length
    };
  });

  findTripById(id: string): LogisticsTrip | undefined {
    return this.trips().find(trip => trip.id === id);
  }
}
