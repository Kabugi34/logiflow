import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { trimmedRequired } from '../../../../core/forms/form-validators';
import { DistributorFleetService } from '../../fleet/fleet.service';
import { DistributorInventoryService } from '../../inventory/inventory.service';
import { DistributorTrip, DistributorTripService } from '../../logistics/trip.service';
import { DistributorOrderService } from '../../orders/order.service';
import { DistributorProcurementService } from '../../procurement/procurement.service';
import {
  WarehouseOrder,
  WarehouseOrderStatus,
  WarehouseReceipt,
} from '../../../warehouse-operations/warehouse-operations.models';
import { WarehouseOperationsService } from '../../../warehouse-operations/warehouse-operations.service';

interface DispatchCandidate {
  trip: DistributorTrip;
  orders: WarehouseOrder[];
  vehicleId: string;
  driverId: string;
  vehicle: ReturnType<DistributorFleetService['findVehicle']>;
  driver: ReturnType<DistributorFleetService['findDriver']>;
}

@Component({
  selector: 'app-distributor-warehouse-operations',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './warehouse-operations.component.html',
})
export class WarehouseOperationsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  protected readonly operations = inject(WarehouseOperationsService);
  protected readonly inventory = inject(DistributorInventoryService);
  protected readonly orderService = inject(DistributorOrderService);
  protected readonly procurement = inject(DistributorProcurementService);
  protected readonly tripService = inject(DistributorTripService);
  protected readonly fleet = inject(DistributorFleetService);
  private readonly sourceSync = effect(() => {
    if (this.inventory.loading() || this.orderService.loading() || this.procurement.loading()) {
      return;
    }

    const inventory = this.inventory.items().map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.name,
      onHand: item.onHand,
    }));
    const orders = this.orderService.orders().map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber ?? order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      lines: order.lines.map((line) => ({
        sku: line.sku,
        product: line.productName,
        quantity: line.quantity,
      })),
    }));
    const receipts = this.procurement.orders().map((order) => ({
      id: order.id,
      status: order.status,
      lines: order.lines
        .filter(
          (line) => Number.isSafeInteger(line.shippedQuantity) && (line.shippedQuantity ?? 0) > 0,
        )
        .map((line) => ({
          sku: line.sku,
          product: line.productName,
          quantity: line.shippedQuantity ?? 0,
        })),
    }));
    untracked(() => this.operations.synchronize(inventory, orders, receipts));
  });

  protected readonly actor = computed(
    () => this.auth.user()?.name.trim() || this.auth.user()?.email || '',
  );
  protected readonly canAdjust = computed(
    () => this.auth.hasRole('DISTRIBUTOR_ADMIN') || this.auth.hasRole('DISTRIBUTOR_STAFF'),
  );
  protected readonly feedback = signal('');
  protected readonly error = signal('');
  protected readonly pendingTripId = signal('');
  protected readonly selectedReceiptId = signal('');
  protected readonly selectedPickOrderId = signal('');
  protected readonly selectedPackOrderId = signal('');
  protected readonly selectedTripId = signal('');
  protected readonly searchStock = signal('');
  protected readonly searchOrders = signal('');
  protected readonly receiptStatusFilter = signal<'ALL' | WarehouseReceipt['status']>('ALL');
  protected readonly orderStatusFilter = signal<'ALL' | WarehouseOrderStatus>('ALL');
  protected readonly packedQuantities = signal<Record<string, number>>({});
  protected readonly adjustmentSku = signal('');
  protected readonly stockDialog = signal<'putaway' | 'adjustment' | ''>('');
  protected readonly sourceLoading = computed(
    () =>
      this.inventory.loading() ||
      this.orderService.loading() ||
      this.procurement.loading() ||
      this.tripService.loading() ||
      this.fleet.loading(),
  );
  protected readonly sourceErrors = computed(() =>
    [
      this.inventory.error(),
      this.orderService.error(),
      this.procurement.error(),
      this.tripService.error(),
      this.fleet.error(),
    ].filter(Boolean),
  );
  protected readonly selectedReceipt = computed(() =>
    this.operations.receipts().find((receipt) => receipt.id === this.selectedReceiptId()),
  );
  protected readonly selectedPickOrder = computed(() =>
    this.operations.awaitingPick().find((order) => order.id === this.selectedPickOrderId()),
  );
  protected readonly selectedPackOrder = computed(() =>
    this.operations.readyToPack().find((order) => order.id === this.selectedPackOrderId()),
  );
  protected readonly dispatchCandidates = computed(() => {
    const orders = this.operations.orders();
    return this.tripService
      .trips()
      .filter(
        (trip) =>
          trip.type === 'DELIVERY' &&
          trip.status === 'SCHEDULED' &&
          !!trip.vehicleId &&
          !!trip.driverId,
      )
      .map((trip) => {
        const vehicleId = trip.vehicleId;
        const driverId = trip.driverId;
        if (!vehicleId || !driverId) return undefined;
        const orderNumbers = trip.stops.map((stop) => stop.orderNumber);
        const tripOrders = orderNumbers.map((orderNumber) =>
          orders.find((order) => order.orderNumber === orderNumber),
        );
        if (
          !orderNumbers.length ||
          orderNumbers.some((orderNumber) => !orderNumber) ||
          tripOrders.some((order) => !order || order.status !== 'READY_TO_DISPATCH')
        ) {
          return undefined;
        }
        return {
          trip,
          orders: tripOrders.filter((order): order is WarehouseOrder => !!order),
          vehicleId,
          driverId,
          vehicle: this.fleet.findVehicle(vehicleId),
          driver: this.fleet.findDriver(driverId),
        };
      })
      .filter((candidate): candidate is DispatchCandidate => !!candidate);
  });
  protected readonly selectedDispatch = computed(() =>
    this.dispatchCandidates().find((candidate) => candidate.trip.id === this.selectedTripId()),
  );
  protected readonly filteredStock = computed(() => {
    const query = this.searchStock().trim().toLowerCase();
    return this.operations
      .stock()
      .filter(
        (item) =>
          !query || [item.sku, item.product].some((value) => value.toLowerCase().includes(query)),
      );
  });
  protected readonly filteredOrders = computed(() => {
    const query = this.searchOrders().trim().toLowerCase();
    return this.operations
      .orders()
      .filter(
        (order) =>
          (this.orderStatusFilter() === 'ALL' || order.status === this.orderStatusFilter()) &&
          (!query ||
            [order.orderNumber, order.id].some((value) => value.toLowerCase().includes(query))),
      );
  });
  protected readonly filteredReceipts = computed(() =>
    this.operations
      .receipts()
      .filter(
        (receipt) =>
          this.receiptStatusFilter() === 'ALL' || receipt.status === this.receiptStatusFilter(),
      ),
  );
  protected readonly stats = computed(() => ({
    inventoryItems: this.operations.stock().length,
    pendingReceipts: this.operations.pendingReceipts().length,
    awaitingPicking: this.operations.awaitingPick().length,
    readyForDispatch: this.operations.readyToDispatch().length,
  }));
  protected readonly recentMovements = computed(() => this.operations.movements().slice(0, 8));

  protected readonly receiptForm = this.fb.nonNullable.group({
    accepted: [0, [Validators.required, Validators.min(0)]],
    damaged: [0, [Validators.required, Validators.min(0)]],
    missing: [0, [Validators.required, Validators.min(0)]],
  });
  protected readonly putAwayForm = this.fb.nonNullable.group({
    location: ['', [trimmedRequired, Validators.maxLength(40)]],
    quantity: [1, [Validators.required, Validators.min(1)]],
  });
  protected readonly pickForm = this.fb.nonNullable.group({
    lineId: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]],
  });
  protected readonly packForm = this.fb.nonNullable.group({
    packages: [1, [Validators.required, Validators.min(1)]],
  });
  protected readonly adjustmentForm = this.fb.nonNullable.group({
    quantity: [0, Validators.required],
    reason: ['', [trimmedRequired, Validators.maxLength(240)]],
  });

  protected openReceipt(receipt: WarehouseReceipt): void {
    this.clearFeedback();
    this.selectedReceiptId.set(receipt.id);
    this.receiptForm.reset({ accepted: receipt.expected, damaged: 0, missing: 0 });
  }

  protected confirmReceipt(): void {
    const receipt = this.selectedReceipt();
    if (!receipt || this.receiptForm.invalid) {
      this.receiptForm.markAllAsTouched();
      return;
    }
    try {
      const { accepted, damaged, missing } = this.receiptForm.getRawValue();
      this.operations.receive(receipt.id, accepted, damaged, missing);
      this.selectedReceiptId.set('');
      this.feedback.set(
        `Receipt ${receipt.reference} confirmed. Accepted stock is now in inventory.`,
      );
      this.error.set('');
    } catch (error) {
      this.showError(error);
    }
  }

  protected openPutAway(sku: string): void {
    this.clearFeedback();
    this.adjustmentSku.set(sku);
    this.stockDialog.set('putaway');
    this.putAwayForm.reset({ location: '', quantity: 1 });
  }

  protected confirmPutAway(): void {
    const sku = this.adjustmentSku();
    if (!sku || this.putAwayForm.invalid) {
      this.putAwayForm.markAllAsTouched();
      return;
    }
    try {
      const { location, quantity } = this.putAwayForm.getRawValue();
      this.operations.putAway(sku, location, quantity, this.actor());
      this.adjustmentSku.set('');
      this.stockDialog.set('');
      this.feedback.set(`${quantity} units put away to ${location.trim()}.`);
      this.error.set('');
    } catch (error) {
      this.showError(error);
    }
  }

  protected openPick(order: WarehouseOrder): void {
    this.clearFeedback();
    this.selectedPickOrderId.set(order.id);
    this.pickForm.reset({ lineId: order.lines[0]?.id ?? '', quantity: 1 });
  }

  protected confirmPick(): void {
    const order = this.selectedPickOrder();
    if (!order || this.pickForm.invalid) {
      this.pickForm.markAllAsTouched();
      return;
    }
    try {
      const { lineId, quantity } = this.pickForm.getRawValue();
      this.operations.pick(order.id, lineId, quantity, this.actor());
      const next = this.operations.orders().find((item) => item.id === order.id);
      if (next?.status === 'READY_TO_PACK') this.selectedPickOrderId.set('');
      this.feedback.set(
        `Picked ${quantity} unit${quantity === 1 ? '' : 's'} for ${order.orderNumber}.`,
      );
      this.error.set('');
    } catch (error) {
      this.showError(error);
    }
  }

  protected openPack(order: WarehouseOrder): void {
    this.clearFeedback();
    this.selectedPackOrderId.set(order.id);
    this.packForm.reset({ packages: Math.max(1, order.packages) });
    this.packedQuantities.set(
      Object.fromEntries(order.lines.map((line) => [line.id, line.picked])),
    );
  }

  protected setPackedQuantity(lineId: string, event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.packedQuantities.update((rows) => ({ ...rows, [lineId]: value }));
  }

  protected confirmPack(): void {
    const order = this.selectedPackOrder();
    if (!order || this.packForm.invalid) {
      this.packForm.markAllAsTouched();
      return;
    }
    try {
      this.operations.pack(
        order.id,
        this.packedQuantities(),
        this.packForm.controls.packages.value,
      );
      this.selectedPackOrderId.set('');
      this.feedback.set(`${order.orderNumber} packed and ready for dispatch.`);
      this.error.set('');
    } catch (error) {
      this.showError(error);
    }
  }

  protected openAdjustment(sku: string): void {
    this.clearFeedback();
    this.adjustmentSku.set(sku);
    this.stockDialog.set('adjustment');
    this.adjustmentForm.reset({ quantity: 0, reason: '' });
  }

  protected confirmAdjustment(): void {
    if (!this.canAdjust()) {
      this.error.set('Only authorized distributor staff can adjust warehouse stock.');
      return;
    }
    const sku = this.adjustmentSku();
    if (!sku || this.adjustmentForm.invalid) {
      this.adjustmentForm.markAllAsTouched();
      return;
    }
    try {
      const { quantity, reason } = this.adjustmentForm.getRawValue();
      this.operations.adjust(sku, quantity, reason, this.actor());
      this.adjustmentSku.set('');
      this.stockDialog.set('');
      this.feedback.set(`Inventory adjustment recorded for ${sku}.`);
      this.error.set('');
    } catch (error) {
      this.showError(error);
    }
  }

  protected openDispatch(tripId: string): void {
    this.clearFeedback();
    this.selectedTripId.set(tripId);
  }

  protected confirmDispatch(): void {
    const candidate = this.selectedDispatch();
    if (!candidate || this.pendingTripId()) return;
    if (!this.actor()) {
      this.error.set('The authenticated dispatcher could not be identified.');
      return;
    }
    const orderIds = candidate.orders.map((order) => order.id);
    try {
      this.operations.validateDispatchOrders(orderIds, {
        tripId: candidate.trip.id,
        vehicleId: candidate.vehicleId,
        driverId: candidate.driverId,
        user: this.actor(),
      });
    } catch (error) {
      this.showError(error);
      return;
    }
    this.pendingTripId.set(candidate.trip.id);
    this.tripService.dispatch(candidate.trip.id).subscribe({
      next: () => {
        try {
          this.operations.dispatchOrders(orderIds, {
            tripId: candidate.trip.id,
            vehicleId: candidate.vehicleId,
            driverId: candidate.driverId,
            user: this.actor(),
          });
          this.feedback.set(
            `${candidate.orders.map((order) => order.orderNumber).join(', ')} dispatched on ${candidate.trip.tripNumber}.`,
          );
          this.error.set('');
          this.selectedTripId.set('');
          this.orderService.refresh();
          this.inventory.refresh();
          this.tripService.refresh();
          this.fleet.refresh();
        } catch (error) {
          const reason = error instanceof Error ? error.message : 'Unknown local ledger error.';
          this.error.set(
            `The trip was dispatched, but the local warehouse ledger could not be updated: ${reason}. Refresh inventory and contact an administrator.`,
          );
        } finally {
          this.pendingTripId.set('');
        }
      },
      error: (error) => {
        this.showError(error, 'Trip dispatch failed.');
        this.pendingTripId.set('');
      },
    });
  }

  protected refresh(): void {
    this.inventory.refresh();
    this.orderService.refresh();
    this.procurement.refreshOrders();
    this.tripService.refresh();
    this.fleet.refresh();
  }

  protected updateStockSearch(event: Event): void {
    this.searchStock.set((event.target as HTMLInputElement).value);
  }

  protected updateOrderSearch(event: Event): void {
    this.searchOrders.set((event.target as HTMLInputElement).value);
  }

  protected updateReceiptStatus(event: Event): void {
    this.receiptStatusFilter.set(
      (event.target as HTMLSelectElement).value as 'ALL' | WarehouseReceipt['status'],
    );
  }

  protected updateOrderStatus(event: Event): void {
    this.orderStatusFilter.set(
      (event.target as HTMLSelectElement).value as 'ALL' | WarehouseOrderStatus,
    );
  }

  protected locationsSummary(item: {
    onHand: number;
    staged: number;
    locations: Record<string, number>;
  }): string {
    const locations = Object.entries(item.locations).map(
      ([location, quantity]) => `${location}: ${quantity}`,
    );
    const unassigned =
      item.onHand -
      item.staged -
      Object.values(item.locations).reduce((sum, quantity) => sum + quantity, 0);
    if (unassigned > 0) locations.push(`Unassigned: ${unassigned}`);
    if (item.staged > 0) locations.push(`Picking: ${item.staged}`);
    return locations.join(', ') || 'No stock assigned';
  }

  protected progress(order: WarehouseOrder): string {
    return order.lines.map((line) => `${line.picked}/${line.allocated} allocated`).join(', ');
  }

  protected orderNumbers(orders: WarehouseOrder[]): string {
    return orders.map((order) => order.orderNumber).join(', ');
  }

  protected closeDialogs(): void {
    this.selectedReceiptId.set('');
    this.selectedPickOrderId.set('');
    this.selectedPackOrderId.set('');
    this.selectedTripId.set('');
    this.adjustmentSku.set('');
    this.stockDialog.set('');
  }

  private clearFeedback(): void {
    this.feedback.set('');
    this.error.set('');
  }

  private showError(error: unknown, fallback = 'Warehouse operation failed.'): void {
    this.error.set(error instanceof Error ? error.message : fallback);
  }
}
