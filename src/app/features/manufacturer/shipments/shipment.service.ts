import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/api/api-endpoints';
import { ManufacturerShipment, normalizeShipmentStatus } from './shipment.models';
import { ManufacturerPurchaseOrderService } from '../purchase-orders/purchase-order.service';
import { map, throwError } from 'rxjs';

export interface NewShipment {
  poReference: string;
  destination: string;
  freightDetails: string;
}
interface Page<T> {
  content?: T[];
}
interface ApiShipment {
  id: string;
  purchaseOrderId: string;
  destinationWarehouseId: string;
  status?: unknown;
  trackingNumber?: string | null;
  carrier?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  [key: string]: unknown;
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
    if (this.loading()) return;
    this.loading.set(true);
    this.http
      .get<Page<ApiShipment> | ApiShipment[]>(
        `${API_ENDPOINTS.manufacturer.shipments}?size=100`,
      )
      .subscribe({
        next: (response) => {
          const shipments = Array.isArray(response) ? response : (response.content ?? []);
          this.shipmentRecords.set(
            shipments.map((shipment) => this.mapShipment(shipment)),
          );
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

  findByPurchaseOrderId(id: string): ManufacturerShipment | undefined {
    return this.shipmentRecords().find((shipment) => shipment.purchaseOrderId === id || shipment.poReference === id);
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
    return this.http.post<ApiShipment>(API_ENDPOINTS.manufacturer.shipments, {
      purchaseOrderId: shipment.poReference,
      destinationWarehouseId: shipment.destination,
      carrier: shipment.freightDetails || undefined,
    }).pipe(map((row) => this.mapShipment(row)));
  }

  updateStatus(id: string, status: 'IN_TRANSIT' | 'CANCELLED', note = '') {
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
    return this.http.patch<ApiShipment>(API_ENDPOINTS.manufacturer.shipmentStatus(id), {
      status,
      ...(note ? { note } : {}),
    }).pipe(map((row) => this.mapShipment(row)));
  }

  private mapShipment(row: ApiShipment): ManufacturerShipment {
    return {
      id: row.id,
      poReference: row.purchaseOrderId,
      purchaseOrderId: row.purchaseOrderId,
      destinationWarehouseId: row.destinationWarehouseId,
      destination: row.destinationWarehouseId,
      destinationFacility: row.destinationWarehouseId,
      freightDetails: row.carrier ?? '',
      carrier: row.carrier ?? '',
      trackingNumber: row.trackingNumber,
      quantity: null,
      unit: '',
      status: normalizeShipmentStatus(row.status),
      tripId: '—',
      assignedDriver: '—',
      vehicle: '—',
      origin: '',
      route: [],
      timeline: [],
    };
  }
}
