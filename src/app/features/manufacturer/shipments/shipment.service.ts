import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { ManufacturerShipment, ShipmentStatus } from './shipment.models';
import { ManufacturerPurchaseOrderService } from '../purchase-orders/purchase-order.service';
import { throwError } from 'rxjs';

export interface NewShipment {
  poReference: string;
  destination: string;
  freightDetails: string;
  quantity: number;
  driverId: string;
  vehicleId: string;
}
interface Page<T> {
  content?: T[];
}

@Injectable({ providedIn: 'root' })
export class ManufacturerShipmentService {
  private readonly http = inject(HttpClient);
  private readonly purchaseOrders = inject(ManufacturerPurchaseOrderService);
  private readonly shipmentRecords = signal<ManufacturerShipment[]>([]);
  readonly shipments = this.shipmentRecords.asReadonly();
  readonly loading = signal(false);
  readonly error = signal('');

  constructor() {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.http
      .get<Page<ManufacturerShipment> | ManufacturerShipment[]>(
        `${API_ENDPOINTS.manufacturer.shipments}?size=100`,
      )
      .subscribe({
        next: (response) => {
          this.shipmentRecords.set(Array.isArray(response) ? response : (response.content ?? []));
          this.error.set('');
          this.loading.set(false);
        },
        error: (error) => {
          this.error.set(error?.error?.message ?? 'Shipments could not be loaded.');
          this.loading.set(false);
        },
      });
  }

  findById(id: string): ManufacturerShipment | undefined {
    return this.shipmentRecords().find((shipment) => shipment.id === id);
  }

  create(shipment: NewShipment) {
    const order = this.purchaseOrders.findById(shipment.poReference);
    if (!order || order.status !== 'ACCEPTED' || order.paymentStatus !== 'PAID') {
      return throwError(
        () =>
          new Error(
            'The purchase order must be accepted and payment must be backend-confirmed before shipment allocation.',
          ),
      );
    }
    return this.http.post<ManufacturerShipment>(API_ENDPOINTS.manufacturer.shipments, {
      purchaseOrderId: shipment.poReference,
      destination: shipment.destination,
      freightDetails: shipment.freightDetails,
      quantity: shipment.quantity,
      driverId: shipment.driverId,
      vehicleId: shipment.vehicleId,
    });
  }

  updateStatus(id: string, status: ShipmentStatus) {
    if (status === 'IN_TRANSIT') {
      const shipment = this.findById(id);
      const order = shipment ? this.purchaseOrders.findById(shipment.poReference) : undefined;
      if (!order || order.status !== 'ACCEPTED' || order.paymentStatus !== 'PAID') {
        return throwError(
          () =>
            new Error(
              'The purchase order must be accepted and payment must be backend-confirmed before shipment dispatch.',
            ),
        );
      }
    }
    return this.http.patch<ManufacturerShipment>(API_ENDPOINTS.manufacturer.shipmentStatus(id), {
      status,
    });
  }
}
