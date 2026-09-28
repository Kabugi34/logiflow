import { Injectable, signal } from '@angular/core';
import { ManufacturerShipment, ShipmentStatus } from './shipment.models';

const chicagoToDallas = [
  { latitude: 41.8781, longitude: -87.6298, label: 'Chicago, IL' },
  { latitude: 39.0997, longitude: -94.5786, label: 'Kansas City, MO' },
  { latitude: 35.4676, longitude: -97.5164, label: 'Oklahoma City, OK' },
  { latitude: 32.7767, longitude: -96.797, label: 'Dallas, TX' }
];

const initialShipments: ManufacturerShipment[] = [
  {
    id: 'SHP-094', poReference: 'PO-2026-981', destination: 'Dallas Depot #4', freightDetails: 'Hydraulic Motors', quantity: 140, unit: 'Pcs', status: 'IN_TRANSIT', tripId: 'TRP-8012', assignedDriver: 'Alex Mercer', vehicle: 'Kenworth T680 (Plate: 409-TDX)', carrier: 'LogiCore', origin: 'Chicago Manufacturing Hub', destinationFacility: 'Dallas Distribution Center', route: chicagoToDallas,
    timeline: [
      { title: 'Checked in Chicago Yard #4', detail: 'Jan 28, 09:30 AM', state: 'COMPLETE' },
      { title: 'Cargo Secured & Dispatched', detail: 'Jan 28, 10:00 AM', state: 'COMPLETE' },
      { title: 'In-Transit (I-55 Southbound)', detail: 'Current Location: Springfield Hub', state: 'CURRENT' }
    ]
  },
  {
    id: 'SHP-092', poReference: 'PO-2026-982', destination: 'Chicago Gate #4', freightDetails: 'Gear Assemblies', quantity: 80, unit: 'Pcs', status: 'DELIVERED', tripId: 'TRP-8010', assignedDriver: 'David Jenkins', vehicle: 'Peterbilt 579 (Plate: 812-OKL)', carrier: 'LogiCore', origin: 'Houston Terminal C-4', destinationFacility: 'Chicago Distribution Gate #4', route: [
      { latitude: 29.7604, longitude: -95.3698, label: 'Houston, TX' },
      { latitude: 35.4676, longitude: -97.5164, label: 'Oklahoma City, OK' },
      { latitude: 41.8781, longitude: -87.6298, label: 'Chicago, IL' }
    ],
    timeline: [{ title: 'Departed Houston Terminal', detail: 'Jan 27, 08:10 AM', state: 'COMPLETE' }, { title: 'Arrived at Chicago Gate #4', detail: 'Jan 28, 12:42 PM', state: 'COMPLETE' }, { title: 'Delivery Confirmed', detail: 'Jan 28, 01:05 PM', state: 'CURRENT' }]
  },
  {
    id: 'SHP-093', poReference: 'PO-2026-983', destination: 'Seattle Harbor Depot', freightDetails: 'Volt-Regulators', quantity: 300, unit: 'Pcs', status: 'BORDER_HOLD', tripId: 'TRP-8015', assignedDriver: 'Sarah Connor', vehicle: 'Freightliner Cascadia (Plate: 556-WQE)', carrier: 'LogiCore', origin: 'Chicago Manufacturing Hub', destinationFacility: 'Seattle Harbor Depot', route: [
      { latitude: 41.8781, longitude: -87.6298, label: 'Chicago, IL' },
      { latitude: 44.9778, longitude: -93.265, label: 'Minneapolis, MN' },
      { latitude: 47.6062, longitude: -122.3321, label: 'Seattle, WA' }
    ],
    timeline: [{ title: 'Dispatched from Chicago', detail: 'Jan 27, 06:20 AM', state: 'COMPLETE' }, { title: 'Documentation Review', detail: 'Jan 28, 11:14 AM', state: 'CURRENT' }]
  },
  {
    id: 'SHP-044', poReference: 'PO-2026-984', destination: 'Houston Terminal B', freightDetails: 'Micro Valves', quantity: 1200, unit: 'Pcs', status: 'IN_TRANSIT', tripId: 'TRP-8016', assignedDriver: 'John Doe', vehicle: 'Volvo VNL (Plate: 733-KLP)', carrier: 'LogiCore', origin: 'Seattle Cargo Center', destinationFacility: 'Houston Terminal B', route: [
      { latitude: 47.6062, longitude: -122.3321, label: 'Seattle, WA' },
      { latitude: 39.0997, longitude: -94.5786, label: 'Kansas City, MO' },
      { latitude: 29.7604, longitude: -95.3698, label: 'Houston, TX' }
    ],
    timeline: [{ title: 'Manifest Synced', detail: 'Jan 28, 07:15 AM', state: 'COMPLETE' }, { title: 'In-Transit', detail: 'En route to Houston Terminal B', state: 'CURRENT' }]
  }
];

export type NewShipment = Pick<ManufacturerShipment, 'poReference' | 'destination' | 'freightDetails' | 'quantity' | 'assignedDriver' | 'tripId'>;

@Injectable({ providedIn: 'root' })
export class ManufacturerShipmentService {
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
      vehicle: 'Unassigned',
      carrier: 'LogiCore',
      origin: 'Chicago Manufacturing Hub',
      destinationFacility: shipment.destination,
      route: chicagoToDallas,
      timeline: [{ title: 'Shipment Allocated', detail: 'Manifest created just now', state: 'CURRENT' }]
    };
    this.shipmentRecords.update(records => [createdShipment, ...records]);
    return id;
  }

  updateStatus(id: string, status: ShipmentStatus): void {
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
