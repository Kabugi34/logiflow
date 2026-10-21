import { computed, Injectable, signal } from '@angular/core';
import { InboundLogisticsOrder, InboundLogisticsStatus, LogisticsRoutePoint } from './logistics.models';

@Injectable({ providedIn: 'root' })
export class LogisticsService {
  private readonly inboundRecords = signal<InboundLogisticsOrder[]>([]);
  readonly inboundOrders = this.inboundRecords.asReadonly();
  readonly inboundShipments = computed(() => this.inboundRecords().filter(order => order.status === 'IN_TRANSIT'));
  findInboundOrder(id: string): InboundLogisticsOrder | undefined { return this.inboundRecords().find(order => order.id === id); }

  createInboundOrder(_input: { manufacturerId: string; manufacturerName: string; manufacturerLocation: string; distributorName: string; destination: string; lines: InboundLogisticsOrder['lines'] }): never {
    throw new Error('Use the live purchase-order API to create purchase orders.');
  }
  updateInboundStatus(_id: string, _status: InboundLogisticsStatus): void { /* No inbound-logistics status endpoint exists. */ }
  dispatchInboundOrder(_id: string, _dispatch: { shipmentId: string; tripId: string; driverName: string; vehicleLabel: string; route?: LogisticsRoutePoint[] }): boolean { return false; }
  advanceInboundCheckpoint(_id: string): void { /* No live tracking endpoint is available here. */ }
  receiveInboundOrder(_id: string): void { /* No inbound receipt endpoint is available here. */ }
}
