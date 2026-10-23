import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DistributorFleetService } from '../../fleet/fleet.service';
import { DistributorInventoryService } from '../../inventory/inventory.service';
import { DistributorOrderService } from '../order.service';
import { CustomerOrderLine } from '../order.models';
import { OrderBadgeComponent } from '../components/order-badge/order-badge.component';
import { timer } from 'rxjs';
import { finalize, switchMap, take, takeWhile } from 'rxjs/operators';

@Component({
  selector: 'app-order-details',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, OrderBadgeComponent],
  templateUrl: './order-details.component.html',
})
export class OrderDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly inventoryService = inject(DistributorInventoryService);
  protected readonly orderService = inject(DistributorOrderService);
  protected readonly fleetService = inject(DistributorFleetService);
  private readonly routeParams = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  protected readonly order = computed(() =>
    this.orderService.findById(this.routeParams().get('id') ?? ''),
  );
  protected readonly assignedVehicle = computed(() =>
    this.fleetService.findVehicle(this.order()?.vehicleId),
  );
  protected readonly assignedDriver = computed(() =>
    this.fleetService.findDriver(this.order()?.driverId),
  );
  protected readonly selectedVehicleId = linkedSignal(
    () => this.fleetService.availableVehicles()[0]?.id ?? '',
  );
  protected readonly selectedDriverId = linkedSignal(
    () => this.fleetService.standbyDrivers()[0]?.id ?? '',
  );
  protected readonly hasStockShortage = computed(
    () => this.order()?.lines.some((line) => this.shortfall(line) > 0) ?? false,
  );
  protected readonly errorMessage = signal('');
  protected readonly paymentPhone = signal('');
  protected readonly paymentMessage = signal('');
  protected readonly showPaymentForm = signal(false);
  protected readonly paymentBusy = signal(false);
  protected readonly statusAction = signal<'IN_TRANSIT' | 'DELIVERED' | null>(null);
  private checkedPaymentOrderId = '';

  constructor() {
    effect(() => {
      const current = this.order();
      if (!current || this.checkedPaymentOrderId === current.id) return;
      this.checkedPaymentOrderId = current.id;
      this.orderService
        .getPaymentStatus(current.id)
        .subscribe({
          next: (result) => this.orderService.recordPaymentStatus(current.id, result.status),
        });
    });
  }

  protected shortfall(line: CustomerOrderLine): number {
    const onHand = this.inventoryService.findBySku(line.sku)?.onHand ?? 0;
    return Math.max(0, line.quantity - onHand);
  }

  protected updateVehicle(event: Event): void {
    this.selectedVehicleId.set((event.target as HTMLSelectElement).value);
  }

  protected updateDriver(event: Event): void {
    this.selectedDriverId.set((event.target as HTMLSelectElement).value);
  }

  protected dispatch(): void {
    const order = this.order();
    if (!order) return;
    this.errorMessage.set('');
    if (this.statusAction()) return;
    this.statusAction.set('IN_TRANSIT');
    try {
      this.orderService.updateStatus(order.id, 'IN_TRANSIT').pipe(
        finalize(() => this.statusAction.set(null)),
      ).subscribe({
        next: () => this.orderService.refresh(),
        error: (error) =>
          this.errorMessage.set(error?.error?.message ?? 'The order status could not be updated.'),
      });
    } catch (error) {
      this.statusAction.set(null);
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Unable to dispatch this order.',
      );
    }
  }

  protected confirmDelivery(): void {
    const order = this.order();
    if (order && !this.statusAction()) {
      this.statusAction.set('DELIVERED');
      this.orderService.updateStatus(order.id, 'DELIVERED').pipe(
        finalize(() => this.statusAction.set(null)),
      ).subscribe({
        next: () => this.orderService.refresh(),
        error: (error) =>
          this.errorMessage.set(error?.error?.message ?? 'The order status could not be updated.'),
      });
    }
  }

  protected markPaid(): void {
    this.showPaymentForm.update((open) => !open);
    this.errorMessage.set('');
  }

  protected updatePaymentPhone(event: Event): void {
    this.paymentPhone.set((event.target as HTMLInputElement).value);
  }

  protected submitPayment(): void {
    const order = this.order();
    const phone = this.paymentPhone().trim();
    if (!order) return;
    if (!/^(?:0|254|[+]254)[17][0-9]{8}$/.test(phone)) {
      this.errorMessage.set('Enter a valid Kenyan mobile number.');
      return;
    }
    this.errorMessage.set('');
    this.paymentMessage.set('');
    this.paymentBusy.set(true);
    this.orderService
      .initiatePayment(order.id, phone)
      .pipe(
        switchMap(() =>
          timer(1000, 5000).pipe(
            switchMap(() => this.orderService.getPaymentStatus(order.id)),
            takeWhile(
              (result) =>
                !['CONFIRMED', 'RECONCILED', 'FAILED', 'REVERSED'].includes(result.status),
              true,
            ),
            take(24),
          ),
        ),
        finalize(() => this.paymentBusy.set(false)),
      )
      .subscribe({
        next: (result) => {
          this.orderService.recordPaymentStatus(order.id, result.status);
          if (result.status === 'CONFIRMED' || result.status === 'RECONCILED') {
            this.paymentMessage.set('Payment confirmed.');
            this.showPaymentForm.set(false);
          } else if (result.status === 'FAILED' || result.status === 'REVERSED')
            this.errorMessage.set(result.failureReason ?? 'The payment was not completed.');
          else this.paymentMessage.set('Waiting for the M-Pesa payment confirmation...');
        },
        error: (error) => {
          this.paymentBusy.set(false);
          this.errorMessage.set(error?.error?.message ?? 'Unable to initiate or check payment.');
        },
      });
  }
}
