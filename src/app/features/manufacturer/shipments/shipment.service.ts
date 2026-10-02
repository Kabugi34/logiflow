import { inject, Injectable, signal } from '@angular/core';
import { ManufacturerFleetService } from '../fleet/fleet.service';
import { ManufacturerShipment, ShipmentStatus } from './shipment.models';

const nairobiToMombasa = [
  { latitude: -1.2864, longitude: 36.8172, label: 'Nairobi, Kenya' },
  { latitude: -0.7172, longitude: 36.4310, label: 'Naivasha, Kenya' },
  { latitude: -3.3960, longitude: 38.5560, label: 'Voi, Kenya' },
  { latitude: -4.0435, longitude: 39.6682, label: 'Mombasa, Kenya' }
];

const initialShipments: ManufacturerShipment[] = [
  {
    id: 'SHP-094', poReference: 'PO-2026-981', destination: 'Mombasa Depot #4', freightDetails: 'Hydraulic Motors', quantity: 140, unit: 'Pcs', status: 'IN_TRANSIT', tripId: 'TRP-8012', assignedDriver: 'Daniel Kamau', vehicle: 'Isuzu FVR (Plate: KDA 123A)', carrier: 'LogiFlow Kenya', origin: 'Nairobi Manufacturing Hub', destinationFacility: 'Mombasa Distribution Centre', route: nairobiToMombasa,
    timeline: [
      { title: 'Checked in Nairobi Yard #4', detail: 'Jan 28, 09:30 AM', state: 'COMPLETE' },
      { title: 'Cargo Secured & Dispatched', detail: 'Jan 28, 10:00 AM', state: 'COMPLETE' },
      { title: 'In transit on A109', detail: 'Current location: Voi checkpoint', state: 'CURRENT' }
    ]
  },
  {
    id: 'SHP-092', poReference: 'PO-2026-982', destination: 'Nairobi Gate #4', freightDetails: 'Gear Assemblies', quantity: 80, unit: 'Pcs', status: 'DELIVERED', tripId: 'TRP-8010', assignedDriver: 'Peter Otieno', vehicle: 'Hino 500 (Plate: KDC 789C)', carrier: 'LogiFlow Kenya', origin: 'Mombasa Terminal C-4', destinationFacility: 'Nairobi Distribution Gate #4', route: [
      { latitude: -4.0435, longitude: 39.6682, label: 'Mombasa, Kenya' },
      { latitude: -3.3960, longitude: 38.5560, label: 'Voi, Kenya' },
      { latitude: -1.2864, longitude: 36.8172, label: 'Nairobi, Kenya' }
    ],
    timeline: [{ title: 'Departed Mombasa Terminal', detail: 'Jan 27, 08:10 AM', state: 'COMPLETE' }, { title: 'Arrived at Nairobi Gate #4', detail: 'Jan 28, 12:42 PM', state: 'COMPLETE' }, { title: 'Delivery Confirmed', detail: 'Jan 28, 01:05 PM', state: 'CURRENT' }]
  },
  {
    id: 'SHP-093', poReference: 'PO-2026-983', destination: 'Kisumu Inland Depot', freightDetails: 'Volt-Regulators', quantity: 300, unit: 'Pcs', status: 'BORDER_HOLD', tripId: 'TRP-8015', assignedDriver: 'Faith Njeri', vehicle: 'Mitsubishi Fuso (Plate: KDB 456B)', carrier: 'LogiFlow Kenya', origin: 'Nairobi Manufacturing Hub', destinationFacility: 'Kisumu Distribution Depot', route: [
      { latitude: -1.2864, longitude: 36.8172, label: 'Nairobi, Kenya' },
      { latitude: -0.3031, longitude: 36.0800, label: 'Nakuru, Kenya' },
      { latitude: -0.0917, longitude: 34.7680, label: 'Kisumu, Kenya' }
    ],
    timeline: [{ title: 'Dispatched from Nairobi', detail: 'Jan 27, 06:20 AM', state: 'COMPLETE' }, { title: 'County weighbridge review', detail: 'Jan 28, 11:14 AM', state: 'CURRENT' }]
  },
  {
    id: 'SHP-044', poReference: 'PO-2026-984', destination: 'Eldoret Terminal B', freightDetails: 'Micro Valves', quantity: 1200, unit: 'Pcs', status: 'IN_TRANSIT', tripId: 'TRP-8016', assignedDriver: 'Kevin Kiptoo', vehicle: 'Isuzu Giga (Plate: KDD 234D)', carrier: 'LogiFlow Kenya', origin: 'Nairobi Cargo Centre', destinationFacility: 'Eldoret Terminal B', route: [
      { latitude: -1.2864, longitude: 36.8172, label: 'Nairobi, Kenya' },
      { latitude: -0.3031, longitude: 36.0800, label: 'Nakuru, Kenya' },
      { latitude: 0.5143, longitude: 35.2698, label: 'Eldoret, Kenya' }
    ],
    timeline: [{ title: 'Manifest Synced', detail: 'Jan 28, 07:15 AM', state: 'COMPLETE' }, { title: 'In transit', detail: 'En route to Eldoret Terminal B', state: 'CURRENT' }]
  }
];

export type NewShipment = Pick<ManufacturerShipment, 'poReference' | 'destination' | 'freightDetails' | 'quantity' | 'assignedDriver' | 'vehicle' | 'tripId'>;

@Injectable({ providedIn: 'root' })
export class ManufacturerShipmentService {
  private readonly fleetService = inject(ManufacturerFleetService);
  private readonly shipmentRecords = signal(initialShipments);
  readonly shipments = this.shipmentRecords.asReadonly();

  findById(id: string): ManufacturerShipment | undefined {
    return this.shipmentRecords().find(shipment => shipment.id === id);
  }

  create(shipment: NewShipment): string {
    const nextNumber = Math.max(94, ...this.shipmentRecords().map(record => Number(record.id.replace('SHP-', '')))) + 1;
    const id = `SHP-${String(nextNumber).padStart(3, '0')}`;
    const createdShipment: ManufacturerShipment = {
      ...shipment,
      id,
      unit: 'Pcs',
      status: 'IN_TRANSIT',
      vehicle: shipment.vehicle,
      carrier: 'LogiCore',
      origin: 'Nairobi Manufacturing Hub',
      destinationFacility: shipment.destination,
      route: nairobiToMombasa,
      timeline: [{ title: 'Shipment Allocated', detail: 'Manifest created just now', state: 'CURRENT' }]
    };
    this.shipmentRecords.update(records => [createdShipment, ...records]);
    return id;
  }

  updateStatus(id: string, status: ShipmentStatus): void {
    const shipment = this.findById(id);
    if (status === 'DELIVERED' && shipment) {
      this.fleetService.completeTrip(shipment.tripId);
    }

    this.shipmentRecords.update(records => records.map(shipment => {
      if (shipment.id !== id) return shipment;
      const title = status === 'DELIVERED' ? 'Delivery Confirmed' : status === 'IN_TRANSIT' ? 'Released from Hold' : 'Border Hold';
      return {
        ...shipment,
        status,
        timeline: [...shipment.timeline, { title, detail: 'Status updated just now', state: 'CURRENT' }]
      };
    }));
  }
}
