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
import { WarehouseOrder } from '../../../warehouse-operations/warehouse-operations.models';
import { WarehouseOperationsService } from '../../../warehouse-operations/warehouse-operations.service';
import { ManufacturerFleetService } from '../../fleet/fleet.service';
import { ManufacturerInventoryService } from '../../inventory/inventory.service';
import { ManufacturerPurchaseOrderService } from '../../purchase-orders/purchase-order.service';
import { ManufacturerShipmentService } from '../../shipments/shipment.service';

@Component({
  selector: 'app-manufacturer-warehouse-operations',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './warehouse-operations.component.html',
})
export class ManufacturerWarehouseOperationsComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  protected readonly operations = inject(WarehouseOperationsService);
  protected readonly inventory = inject(ManufacturerInventoryService);
  protected readonly purchaseOrders = inject(ManufacturerPurchaseOrderService);
  protected readonly shipments = inject(ManufacturerShipmentService);
  protected readonly fleet = inject(ManufacturerFleetService);
  private readonly sourceSync = effect(() => {
    if (this.inventory.loading() || this.purchaseOrders.loading()) return;
    const inventory = this.inventory.getRows().map((item) => ({
      id: item.sku,
      sku: item.sku,
      name: item.productName,
      onHand: item.totalStock,
    }));
    const orders = this.purchaseOrders.orders().map((order) => ({
      id: order.id,
      orderNumber: order.id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      lines: order.lines.map((line) => ({
        sku: line.sku,
        product: line.productName,
        quantity: line.requestedQuantity,
      })),
    }));
    untracked(() => this.operations.synchronize(inventory, orders, []));
  });

  protected readonly actor = computed(
    () => this.auth.user()?.name.trim() || this.auth.user()?.email || '',
  );
  protected readonly canAdjust = computed(
    () => this.auth.hasRole('MANUFACTURER_ADMIN') || this.auth.hasRole('MANUFACTURER_STAFF'),
  );
  protected readonly feedback = signal('');
  protected readonly error = signal('');
  protected readonly saving = signal(false);
  protected readonly selectedPickOrderId = signal('');
  protected readonly selectedPackOrderId = signal('');
  protected readonly selectedDispatchOrderId = signal('');
  protected readonly adjustmentSku = signal('');
  protected readonly stockDialog = signal<'putaway' | 'adjustment' | ''>('');
  protected readonly searchStock = signal('');
  protected readonly searchOrders = signal('');
  protected readonly orderStatusFilter = signal('ALL');
  protected readonly packedQuantities = signal<Record<string, number>>({});

  protected readonly readyDrivers = computed(() =>
    this.fleet.drivers().filter((driver) => {
      if (
        driver.accountStatus !== 'ACTIVE' ||
        driver.operationalStatus !== 'AVAILABLE' ||
        driver.currentTripId
      ) {
        return false;
      }
      const vehicle = driver.vehicleId ? this.fleet.findVehicle(driver.vehicleId) : undefined;
      return (
        !!vehicle &&
        vehicle.assignedDriverId === driver.id &&
        this.fleet.vehicleStatus(vehicle) === 'STANDBY' &&
        !vehicle.currentTripId
      );
    }),
  );
  protected readonly selectedPickOrder = computed(() =>
    this.operations.awaitingPick().find((order) => order.id === this.selectedPickOrderId()),
  );
  protected readonly selectedPackOrder = computed(() =>
    this.operations.readyToPack().find((order) => order.id === this.selectedPackOrderId()),
  );
  protected readonly selectedDispatchOrder = computed(() =>
    this.operations.readyToDispatch().find((order) => order.id === this.selectedDispatchOrderId()),
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
  protected readonly stats = computed(() => ({
    inventoryItems: this.operations.stock().length,
    awaitingPayment: this.purchaseOrders
      .orders()
      .filter((order) => order.status === 'ACCEPTED' && order.paymentStatus !== 'PAID').length,
    awaitingPicking: this.operations.awaitingPick().length,
    readyForDispatch: this.operations.readyToDispatch().length,
  }));
  protected readonly recentMovements = computed(() => this.operations.movements().slice(0, 8));

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
  protected readonly dispatchForm = this.fb.nonNullable.group({
    driverId: ['', Validators.required],
  });
  protected readonly adjustmentForm = this.fb.nonNullable.group({
    quantity: [0, Validators.required],
    reason: ['', [trimmedRequired, Validators.maxLength(240)]],
  });

  protected openPutAway(sku: string): void {
    this.clearFeedback();
    this.adjustmentSku.set(sku);
    this.stockDialog.set('putaway');
    this.putAwayForm.reset({ location: '', quantity: 1 });
  }

  protected confirmPutAway(): void {
    if (!this.adjustmentSku() || this.putAwayForm.invalid) {
      this.putAwayForm.markAllAsTouched();
      return;
    }
    try {
      const { location, quantity } = this.putAwayForm.getRawValue();
      this.operations.putAway(this.adjustmentSku(), location, quantity, this.actor());
      this.stockDialog.set('');
      this.adjustmentSku.set('');
      this.feedback.set(`${quantity} units put away to ${location.trim()}.`);
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
      this.error.set('Only authorized manufacturer staff can adjust warehouse stock.');
      return;
    }
    if (!this.adjustmentSku() || this.adjustmentForm.invalid) {
      this.adjustmentForm.markAllAsTouched();
      return;
    }
    try {
      const { quantity, reason } = this.adjustmentForm.getRawValue();
      const sku = this.adjustmentSku();
      this.operations.adjust(sku, quantity, reason, this.actor());
      this.stockDialog.set('');
      this.adjustmentSku.set('');
      this.feedback.set(`Inventory adjustment recorded for ${sku}.`);
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
    if (!this.isPaymentVerified(order.id)) {
      this.error.set('Picking is blocked until backend payment reconciliation reports PAID.');
      return;
    }
    try {
      const { lineId, quantity } = this.pickForm.getRawValue();
      this.operations.pick(order.id, lineId, quantity, this.actor());
      if (
        this.operations.orders().find((item) => item.id === order.id)?.status === 'READY_TO_PACK'
      ) {
        this.selectedPickOrderId.set('');
      }
      this.feedback.set(`Picked ${quantity} units for purchase order ${order.orderNumber}.`);
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
    this.packedQuantities.update((rows) => ({
      ...rows,
      [lineId]: Number((event.target as HTMLInputElement).value),
    }));
  }

  protected confirmPack(): void {
    const order = this.selectedPackOrder();
    if (!order || this.packForm.invalid) {
      this.packForm.markAllAsTouched();
      return;
    }
    if (!this.isPaymentVerified(order.id)) {
      this.error.set('Packing is blocked until backend payment reconciliation reports PAID.');
      return;
    }
    try {
      this.operations.pack(
        order.id,
        this.packedQuantities(),
        this.packForm.controls.packages.value,
      );
      this.selectedPackOrderId.set('');
      this.feedback.set(`Purchase order ${order.orderNumber} packed and ready for dispatch.`);
      this.error.set('');
    } catch (error) {
      this.showError(error);
    }
  }

  protected openDispatch(order: WarehouseOrder): void {
    this.clearFeedback();
    this.selectedDispatchOrderId.set(order.id);
    this.dispatchForm.reset({ driverId: this.readyDrivers()[0]?.id ?? '' });
  }

  protected confirmDispatch(): void {
    const order = this.selectedDispatchOrder();
    const driver = this.fleet.findDriver(this.dispatchForm.controls.driverId.value);
    const vehicle = driver?.vehicleId ? this.fleet.findVehicle(driver.vehicleId) : undefined;
    if (!order || this.dispatchForm.invalid || !driver || !vehicle || this.saving()) {
      this.dispatchForm.markAllAsTouched();
      return;
    }
    if (!this.actor()) {
      this.error.set('The authenticated dispatcher could not be identified.');
      return;
    }
    const purchaseOrder = this.purchaseOrders.findById(order.id);
    if (
      !purchaseOrder ||
      purchaseOrder.status !== 'ACCEPTED' ||
      purchaseOrder.paymentStatus !== 'PAID'
    ) {
      this.error.set(
        'This purchase order is not accepted with verified payment and cannot be shipped.',
      );
      return;
    }
    try {
      this.operations.validateDispatchOrders([order.id], {
        tripId: `PENDING-${purchaseOrder.id}`,
        vehicleId: vehicle.id,
        driverId: driver.id,
        user: this.actor(),
      });
    } catch (error) {
      this.showError(error);
      return;
    }

    this.saving.set(true);
    this.shipments
      .create({
        poReference: purchaseOrder.id,
        destination: purchaseOrder.destinationHub,
        freightDetails: order.lines.map((line) => line.product).join(', '),
        quantity: order.lines.reduce((sum, line) => sum + line.packed, 0),
        driverId: driver.id,
        vehicleId: vehicle.id,
      })
      .subscribe({
        next: (shipment) => {
          try {
            this.operations.dispatchOrders([order.id], {
              tripId: shipment.tripId,
              vehicleId: vehicle.id,
              driverId: driver.id,
              user: this.actor(),
            });
            this.feedback.set(
              `Purchase order ${order.orderNumber} dispatched on shipment ${shipment.id}.`,
            );
            this.error.set('');
            this.selectedDispatchOrderId.set('');
            this.inventory.refresh();
            this.purchaseOrders.refresh();
            this.shipments.refresh();
            this.fleet.refresh();
          } catch (error) {
            const reason = error instanceof Error ? error.message : 'Unknown local ledger error.';
            this.error.set(
              `Shipment ${shipment.id} was created, but the local warehouse ledger could not be updated: ${reason}. Refresh inventory and contact an administrator.`,
            );
          } finally {
            this.saving.set(false);
          }
        },
        error: (error) => {
          this.showError(error, 'Shipment could not be created.');
          this.saving.set(false);
        },
      });
  }

  protected closeDialogs(): void {
    this.selectedPickOrderId.set('');
    this.selectedPackOrderId.set('');
    this.selectedDispatchOrderId.set('');
    this.adjustmentSku.set('');
    this.stockDialog.set('');
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

  protected updateStockSearch(event: Event): void {
    this.searchStock.set((event.target as HTMLInputElement).value);
  }

  protected updateOrderSearch(event: Event): void {
    this.searchOrders.set((event.target as HTMLInputElement).value);
  }

  protected updateOrderStatus(event: Event): void {
    this.orderStatusFilter.set((event.target as HTMLSelectElement).value);
  }

  protected orderNumbers(orders: WarehouseOrder[]): string {
    return orders.map((order) => order.orderNumber).join(', ');
  }

  protected refresh(): void {
    this.inventory.refresh();
    this.purchaseOrders.refresh();
    this.shipments.refresh();
    this.fleet.refresh();
  }

  private clearFeedback(): void {
    this.feedback.set('');
    this.error.set('');
  }

  private isPaymentVerified(orderId: string): boolean {
    const purchaseOrder = this.purchaseOrders.findById(orderId);
    return purchaseOrder?.status === 'ACCEPTED' && purchaseOrder.paymentStatus === 'PAID';
  }

  private showError(error: unknown, fallback = 'Warehouse operation failed.'): void {
    this.error.set(error instanceof Error ? error.message : fallback);
  }
}
