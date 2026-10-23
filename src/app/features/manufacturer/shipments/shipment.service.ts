import { Injectable, signal } from '@angular/core';
import { ManufacturerShipment, ShipmentStatus } from './shipment.models';
import { ManufacturerFleetService } from '../fleet/fleet.service';
import { inject } from '@angular/core';

export interface NewShipment {
  poReference: string; destination: string; freightDetails: string; quantity: number;
  assignedDriver: string; vehicle: string; tripId: string;
}

@Injectable({ providedIn: 'root' })
export class ManufacturerShipmentService {
  private readonly fleetService = inject(ManufacturerFleetService);
  private readonly shipmentRecords = signal<ManufacturerShipment[]>([]);
  readonly shipments = this.shipmentRecords.asReadonly();
  findById(id: string): ManufacturerShipment | undefined { return this.shipmentRecords().find(shipment => shipment.id === id); }
  create(shipment: NewShipment): string {
    const id = `SHP-${Date.now()}`;
    this.shipmentRecords.update(rows => [...rows, {
      id, poReference: shipment.poReference, destination: shipment.destination, freightDetails: shipment.freightDetails,
      quantity: shipment.quantity, unit: 'units', status: 'IN_TRANSIT', tripId: shipment.tripId,
      assignedDriver: shipment.assignedDriver, vehicle: shipment.vehicle,
      origin: 'Manufacturer depot', destinationFacility: shipment.destination,
      route: [{ label: shipment.destination, latitude: -1.2864, longitude: 36.8172 }],
      timeline: [{ title: 'Dispatch started', detail: 'Shipment released to the fleet.', state: 'COMPLETE' }, { title: 'Delivery confirmation', detail: 'Awaiting receiving confirmation.', state: 'CURRENT' }],
      carrier: 'Company Fleet'
    }]);
    return id;
  }
  updateStatus(id: string, status: ShipmentStatus): void {
    this.shipmentRecords.update(rows => rows.map(shipment => shipment.id === id ? { ...shipment, status } : shipment));
    if (status === 'DELIVERED') {
      const shipment = this.findById(id);
      if (shipment) this.fleetService.completeTrip(shipment.tripId);
    }
  }
}
