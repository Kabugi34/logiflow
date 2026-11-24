import { FormValidationSummaryComponent } from '../../../../shared/forms/form-validation-summary.component';
import { Component, computed, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ManufacturerPurchaseOrderService } from '../../purchase-orders/purchase-order.service';
import { ManufacturerShipmentService, NewShipment } from '../shipment.service';
import { ShipmentStatus } from '../shipment.models';
import { trimmedRequired } from '../../../../core/forms/form-validators';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-shipment-list',
  standalone: true,
  imports: [FormValidationSummaryComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './shipment-list.component.html',
})
export class ShipmentListComponent {
  private readonly shipmentService = inject(ManufacturerShipmentService);
  private readonly purchaseOrderService = inject(ManufacturerPurchaseOrderService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  protected readonly selectedStatus = signal('ACTIVE');
  protected readonly isAllocationOpen = signal(false);
  protected readonly allocationError = signal('');
  protected readonly saving = signal(false);
  protected readonly dispatchableOrders = computed(() =>
    this.purchaseOrderService
      .orders()
      .filter((order) => order.status === 'ACCEPTED' && order.paymentStatus === 'PAID' && order.fulfilmentStatus === 'READY_FOR_DISPATCH'),
  );
  protected readonly shipments = computed(() =>
    this.shipmentService.shipments().filter((shipment) => {
      const status = this.selectedStatus();
      return (
        status === 'ALL' ||
        (status === 'ACTIVE'
          ? shipment.status === 'READY_FOR_DISPATCH' || shipment.status === 'IN_TRANSIT'
          : shipment.status === status)
      );
    }),
  );
  protected readonly form = this.formBuilder.nonNullable.group({
    poReference: ['', trimmedRequired],
    destination: ['', [trimmedRequired, Validators.pattern(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)]],
    freightDetails: ['', Validators.maxLength(100)],
    trackingNumber: ['', Validators.maxLength(100)],
  });

  protected setStatus(event: Event): void {
    this.selectedStatus.set((event.target as HTMLSelectElement).value);
  }

  protected openAllocation(): void {
    this.allocationError.set('');
    const firstOrderId = this.dispatchableOrders()[0]?.id ?? '';
    this.form.reset({
      poReference: firstOrderId,
      destination: '',
      freightDetails: '',
      trackingNumber: '',
    });
    this.updateOrderDefaults();
    this.isAllocationOpen.set(true);
  }

  protected updateOrderDefaults(): void {
    const order = this.purchaseOrderService.findById(this.form.controls.poReference.value);
    this.form.controls.destination.setValue(order?.destinationWarehouseId ?? '');
    this.form.controls.destination.markAsUntouched();
  }

  protected destinationFromOrder(): boolean {
    return !!this.purchaseOrderService.findById(this.form.controls.poReference.value)?.destinationWarehouseId;
  }

  protected closeAllocation(): void {
    this.isAllocationOpen.set(false);
  }

  protected allocate(): void {
    if (this.saving()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const order = this.purchaseOrderService.findById(this.form.controls.poReference.value);
    if (!order) {
      this.allocationError.set('Select a valid purchase order.');
      return;
    }
    if (!order.destinationWarehouseId) {
      this.allocationError.set(
        'The purchase-order API did not return the destination warehouse selected at checkout. Refresh the order or have the backend return destinationWarehouseId before allocating a shipment.',
      );
      return;
    }
    if (order.status !== 'ACCEPTED' || order.paymentStatus !== 'PAID' || order.fulfilmentStatus !== 'READY_FOR_DISPATCH') {
      this.allocationError.set(
        'The purchase order must be approved, payment-verified, and fully picked and packed before consignment creation.',
      );
      return;
    }
    this.saving.set(true);
    this.shipmentService
      .create({
        poReference: this.form.controls.poReference.value,
        destination: this.form.controls.destination.value,
        freightDetails: this.form.controls.freightDetails.value,
        trackingNumber: this.form.controls.trackingNumber.value,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (shipment) => {
          this.shipmentService.refresh();
          this.isAllocationOpen.set(false);
          void this.router.navigate(['/manufacturer/shipments', shipment.id], {
            queryParamsHandling: 'preserve',
          });
        },
        error: (error) =>
          this.allocationError.set(
            error?.error?.message ??
              'Shipment could not be allocated. Check purchase order and fleet availability.',
          ),
      });
  }

  protected statusLabel(status: ShipmentStatus): string {
    switch (status) {
      case 'AWAITING_PICKING': return 'AWAITING PICKING';
      case 'READY_FOR_DISPATCH':
        return 'READY FOR DISPATCH';
      case 'RECEIVED':
        return 'RECEIVED';
      case 'CANCELLED':
        return 'CANCELLED';
      case 'IN_TRANSIT':
        return 'IN TRANSIT';
      case 'DELIVERED':
        return 'DELIVERED';
      case 'UNKNOWN':
        return 'UNKNOWN STATUS';
    }
  }

  protected statusClass(status: ShipmentStatus): string {
    switch (status) {
      case 'AWAITING_PICKING': return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'READY_FOR_DISPATCH':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'RECEIVED':
      case 'CANCELLED':
        return 'border-slate-200 bg-slate-50 text-slate-600';
      case 'IN_TRANSIT':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'DELIVERED':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'UNKNOWN':
        return 'border-slate-200 bg-slate-50 text-slate-600';
    }
  }
}
