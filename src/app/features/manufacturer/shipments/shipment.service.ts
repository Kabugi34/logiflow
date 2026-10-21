import { Injectable, signal } from '@angular/core';
import { ManufacturerShipment, ShipmentStatus } from './shipment.models';

export interface NewShipment {
  poReference: string; destination: string; freightDetails: string; quantity: number;
  assignedDriver: string; vehicle: string; tripId: string;
}

@Injectable({ providedIn: 'root' })
export class ManufacturerShipmentService {
  // Shipment list and dispatch APIs are not available in the current backend.
  private readonly shipmentRecords = signal<ManufacturerShipment[]>([]);
  readonly shipments = this.shipmentRecords.asReadonly();
  findById(id: string): ManufacturerShipment | undefined { return this.shipmentRecords().find(shipment => shipment.id === id); }
  create(_shipment: NewShipment): never { throw new Error('Shipment dispatch is unavailable because the backend has no shipment or fleet assignment endpoint yet.'); }
  updateStatus(_id: string, _status: ShipmentStatus): void { /* No backend shipment status endpoint exists. */ }
}
