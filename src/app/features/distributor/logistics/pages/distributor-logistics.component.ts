import { FormValidationSummaryComponent } from '../../../../shared/forms/form-validation-summary.component';
import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { InboundLogisticsOrder } from '../../../../core/logistics/logistics.models';
import { DistributorProcurementService } from '../../procurement/procurement.service';
import { LogisticsRouteMapComponent } from '../../../../shared/maps/logistics-route-map.component';
import { DistributorOrderService } from '../../orders/order.service';
import { DistributorTripService } from '../trip.service';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DistributorFleetService } from '../../fleet/fleet.service';
import {
  internationalPhone,
  personName,
  trimmedRequired,
} from '../../../../core/forms/form-validators';

@Component({
  selector: 'app-distributor-logistics',
  standalone: true,
  imports: [
    FormValidationSummaryComponent,
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    LogisticsRouteMapComponent,
  ],
  templateUrl: './distributor-logistics.component.html',
})
export class DistributorLogisticsComponent {
  private readonly procurementService = inject(DistributorProcurementService);
  private readonly orderService = inject(DistributorOrderService);
  private readonly fb = inject(FormBuilder);
  protected readonly fleetService = inject(DistributorFleetService);
  protected readonly tripService = inject(DistributorTripService);
  protected readonly selectedTripId = signal('');
  protected readonly selectedTrip = computed(() =>
    this.tripService.findById(this.selectedTripId()),
  );
  protected readonly createTripOpen = signal(false);
  protected readonly tripFormError = signal('');
  protected readonly selectedRiderId = signal('');
  protected readonly assignmentMessage = signal('');
  protected readonly tripForm = this.fb.nonNullable.group({
    type: ['DELIVERY' as 'DELIVERY' | 'RESTOCK', Validators.required],
    originName: ['', [trimmedRequired, Validators.maxLength(100)]],
    originAddress: ['', [trimmedRequired, Validators.maxLength(200)]],
    originLat: [-1.2864, [Validators.required, Validators.min(-90), Validators.max(90)]],
    originLng: [36.8172, [Validators.required, Validators.min(-180), Validators.max(180)]],
    destinationName: ['', [trimmedRequired, Validators.maxLength(100)]],
    destinationAddress: ['', [trimmedRequired, Validators.maxLength(200)]],
    destinationLat: [-1.2864, [Validators.required, Validators.min(-90), Validators.max(90)]],
    destinationLng: [36.8172, [Validators.required, Validators.min(-180), Validators.max(180)]],
    scheduledStartLabel: ['', Validators.pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/)],
    contactName: ['', [personName, Validators.maxLength(80)]],
    contactPhone: ['', [internationalPhone, Validators.maxLength(32)]],
    orderId: ['', Validators.maxLength(80)],
  });
  protected readonly selectedTripPings = computed(
    () => this.tripService.tracking()[this.selectedTripId()] ?? [],
  );
  protected readonly selectedTripRoute = computed(() => {
    const trip = this.selectedTrip();
    if (!trip) return [];
    const route = [trip.origin, ...trip.stops.map((stop) => stop.location)].map((point) => ({
      latitude: point.latitude,
      longitude: point.longitude,
      label: point.name,
    }));
    const latest = this.selectedTripPings().at(-1);
    return latest
      ? [...route, { latitude: latest.lat, longitude: latest.lng, label: 'Live location' }]
      : route;
  });

  readonly inboundOrders = computed<InboundLogisticsOrder[]>(() =>
    this.procurementService
      .orders()
      .map((order) => ({
        id: order.id,
        manufacturerId: order.manufacturerId,
        manufacturerName: order.manufacturerName,
        manufacturerLocation: '',
        distributorName: '',
        orderDate: order.orderDate,
        expectedDelivery: '',
        status: (order.status === 'PROCESSING'
          ? 'PROCESSING'
          : order.status === 'DELIVERED'
            ? 'DELIVERED'
            : order.status === 'REJECTED'
              ? 'REJECTED'
              : 'PENDING') as InboundLogisticsOrder['status'],
        destination: '',
        logisticsCost: order.logisticsCost,
        lines: order.lines.map((line) => ({
          sku: line.sku,
          productName: line.productName,
          quantity: line.quantity,
          unit: line.unit,
          unitCost: line.unitCost,
        })),
        timeline: [],
        route: [],
        currentRouteIndex: 0,
      }))
      .filter((order) => order.status !== 'DELIVERED' && order.status !== 'REJECTED'),
  );

  readonly outboundOrders = computed(() =>
    this.orderService
      .activeOrders()
      .filter((order) => order.status !== 'COMPLETED')
      .slice(0, 4),
  );

  readonly outboundShipments = computed(() => this.orderService.groupOrdersByRoute());

  readonly selectedInboundId = signal('');
  readonly selectedOutboundId = signal('SHP-001');

  readonly selectedInbound = computed(
    () =>
      this.inboundOrders().find((order) => order.id === this.selectedInboundId()) ??
      this.inboundOrders()[0],
  );

  readonly selectedOutboundShipment = computed(
    () =>
      this.outboundShipments().find((shipment) => shipment.id === this.selectedOutboundId()) ??
      this.outboundShipments()[0],
  );

  readonly selectedOutbound = computed(
    () =>
      this.selectedOutboundShipment()?.orders[0] ??
      this.outboundOrders().find((order) => order.id === this.selectedOutboundId()) ??
      this.outboundOrders()[0],
  );

  readonly inboundRoute = computed(() => this.selectedInbound()?.route ?? []);

  readonly outboundRoute = computed(() => this.selectedOutboundShipment()?.route ?? []);

  readonly inboundShipmentsInMotion = computed(
    () => this.inboundOrders().filter((order) => order.status === 'IN_TRANSIT').length,
  );

  readonly outboundDeliveriesInMotion = computed(
    () =>
      this.outboundShipments().filter(
        (shipment) => shipment.status === 'IN_TRANSIT' || shipment.status === 'REROUTED',
      ).length,
  );

  readonly onTimeInboundRate = computed<number | null>(() => null);

  protected loadTripTracking(id: string): void {
    this.selectedTripId.set(id);
    this.tripService.loadTracking(id);
  }

  protected createTrip(): void {
    if (this.tripForm.invalid) {
      this.tripForm.markAllAsTouched();
      return;
    }
    this.tripFormError.set('');
    const value = this.tripForm.getRawValue();
    this.tripService
      .create({
        tripType: value.type,
        origin: {
          name: value.originName,
          address: value.originAddress,
          latitude: value.originLat,
          longitude: value.originLng,
        },
        scheduledStartLabel: value.scheduledStartLabel || undefined,
        stops: [
          {
            sequence: 1,
            location: {
              name: value.destinationName,
              address: value.destinationAddress,
              latitude: value.destinationLat,
              longitude: value.destinationLng,
            },
            contactName: value.contactName || undefined,
            contactPhone: value.contactPhone || undefined,
            orderId: value.orderId || undefined,
          },
        ],
      })
      .subscribe({
        next: (trip) => {
          this.tripService.refresh();
          this.selectedTripId.set(trip.id);
          this.createTripOpen.set(false);
        },
        error: (error) =>
          this.tripFormError.set(
            error?.error?.message ??
              'Trip could not be created. Check the trip API and required fields.',
          ),
      });
  }

  protected assignSelectedDriver(): void {
    const tripId = this.selectedTripId();
    const driverId = this.selectedRiderId();
    if (!tripId || !driverId) {
      this.assignmentMessage.set('Select a trip and an available driver.');
      return;
    }
    this.tripService.assignDriver(tripId, driverId).subscribe({
      next: () => {
        this.tripService.refresh();
        this.assignmentMessage.set('Driver assignment updated.');
      },
      error: (error) =>
        this.assignmentMessage.set(
          error?.error?.message ?? 'Driver assignment could not be saved.',
        ),
    });
  }

  protected updateTripStatus(id: string, status: 'ONGOING' | 'COMPLETED'): void {
    this.tripService.updateStatus(id, status).subscribe({
      next: () => this.tripService.refresh(),
      error: (error) =>
        this.tripService.error.set(error?.error?.message ?? 'Trip status could not be updated.'),
    });
  }

  selectInbound(id: string): void {
    this.selectedInboundId.set(id);
  }

  selectOutbound(id: string): void {
    this.selectedOutboundId.set(id);
    this.tripService.loadTracking(id);
  }

  inboundStatusClass(status: string): string {
    switch (status) {
      case 'IN_TRANSIT':
        return 'border border-blue-200 bg-blue-50 text-blue-700';
      case 'PROCESSING':
        return 'border border-amber-200 bg-amber-50 text-amber-700';
      case 'PENDING':
        return 'border border-slate-200 bg-slate-100 text-slate-700';
      case 'DELIVERED':
        return 'border border-emerald-200 bg-emerald-50 text-emerald-700';
      default:
        return 'border border-slate-200 bg-slate-100 text-slate-700';
    }
  }

  outboundStatusClass(status: string): string {
    switch (status) {
      case 'IN_TRANSIT':
        return 'border border-blue-200 bg-blue-50 text-blue-700';
      case 'REROUTED':
        return 'border border-orange-200 bg-orange-50 text-orange-700';
      case 'PREPARING':
        return 'border border-slate-200 bg-slate-100 text-slate-700';
      case 'COMPLETED':
        return 'border border-emerald-200 bg-emerald-50 text-emerald-700';
      default:
        return 'border border-slate-200 bg-slate-100 text-slate-700';
    }
  }
}
