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
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
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

interface ReceiptLineForm {
  purchaseOrderItemId: FormControl<string>;
  acceptedQuantity: FormControl<number>;
  damagedQuantity: FormControl<number>;
  missingQuantity: FormControl<number>;
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
  constructor() {
    this.operations.loadShipments();
  }
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
        orderItemId: line.orderItemId,
        stockItemId: line.stockItemId,
        sku: line.sku,
        product: line.productName,
        quantity: line.quantity,
        pickedQuantity: line.pickedQuantity,
        packedQuantity: line.packedQuantity,
      })),
    }));
    untracked(() => this.operations.synchronize(inventory, orders, 'DISTRIBUTOR'));
  });

  protected readonly actor = computed(
    () => this.auth.user()?.name.trim() || this.auth.user()?.email || '',
  );
  protected readonly canAdjust = computed(
    () => this.auth.hasRole('DISTRIBUTOR_ADMIN') || this.auth.hasRole('DISTRIBUTOR_STAFF'),
  );
  protected readonly feedback = signal('');
  protected readonly error = signal('');
  protected readonly saving = signal(false);
  protected readonly pendingTripId = signal('');
  protected readonly selectedReceiptId = signal('');
  protected readonly selectedPickOrderId = signal('');
  protected readonly selectedPackOrderId = signal('');
  protected readonly selectedTripId = signal('');
  protected readonly searchStock = signal('');
  protected readonly searchOrders = signal('');
  protected readonly receiptStatusFilter = signal<'ALL' | WarehouseReceipt['status']>('ALL');
  protected readonly orderStatusFilter = signal<'ALL' | WarehouseOrderStatus>('ALL');
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

  protected readonly receiptForm = this.fb.group({
    note: this.fb.nonNullable.control('', [Validators.maxLength(2000)]),
    lines: this.fb.array<FormGroup<ReceiptLineForm>>([]),
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
    const lines = this.receiptForm.controls.lines;
    while (lines.length) lines.removeAt(0);
    for (const line of receipt.lines) {
      lines.push(
        this.fb.nonNullable.group({
          purchaseOrderItemId: line.purchaseOrderItemId,
          acceptedQuantity: [line.accepted ?? line.expected, [Validators.required, Validators.min(0)]],
          damagedQuantity: [line.damaged ?? 0, [Validators.required, Validators.min(0)]],
          missingQuantity: [line.missing ?? 0, [Validators.required, Validators.min(0)]],
        }),
      );
    }
    this.receiptForm.controls.note.setValue('');
    this.receiptForm.controls.note.markAsPristine();
  }

  protected openPutAway(sku: string): void {
    this.clearFeedback();
    this.adjustmentSku.set(sku);
    this.stockDialog.set('putaway');
    this.putAwayForm.reset({ location: '', quantity: 1 });
  }

  protected openPick(order: WarehouseOrder): void {
    this.clearFeedback();
    this.selectedPickOrderId.set(order.id);
    this.pickForm.reset({ lineId: order.lines[0]?.id ?? '', quantity: 1 });
  }

  protected openPack(order: WarehouseOrder): void {
    this.clearFeedback();
    this.selectedPackOrderId.set(order.id);
    this.packForm.reset({ packages: Math.max(1, order.packages) });
  }

  protected confirmReceipt(): void {
    const receipt = this.selectedReceipt();
    if (!receipt || this.receiptForm.invalid) {
      this.receiptForm.markAllAsTouched();
      return;
    }
    if (receipt.shipmentStatus !== 'DELIVERED') {
      this.error.set('Only a backend-delivered shipment can be received.');
      return;
    }
    const raw = this.receiptForm.getRawValue();
    const lines = raw.lines.map((line, index) => {
      const expected = receipt.lines[index]?.expected;
      return { ...line, expected };
    });
    if (
      lines.some(
        (line) =>
          line.acceptedQuantity + line.damagedQuantity + line.missingQuantity !== line.expected,
      )
    ) {
      this.error.set('Accepted, damaged, and missing quantities must equal each item quantity.');
      return;
    }
    this.saving.set(true);
    this.operations
      .receiveShipment(receipt.shipmentId, {
        note: raw.note.trim() || undefined,
        lines: raw.lines.map(
          ({ purchaseOrderItemId, acceptedQuantity, damagedQuantity, missingQuantity }) => ({
            purchaseOrderItemId,
            acceptedQuantity,
            damagedQuantity,
            missingQuantity,
          }),
        ),
      })
      .subscribe({
        next: () => {
          this.selectedReceiptId.set('');
          this.feedback.set(`Receipt ${receipt.reference} was confirmed by the backend.`);
          this.error.set('');
          this.inventory.refresh();
          this.procurement.refreshOrders();
          this.operations.refreshPersistedWarehouseData('DISTRIBUTOR');
          this.saving.set(false);
        },
        error: (error) => {
          this.showError(error, 'Shipment receipt could not be confirmed.');
          this.saving.set(false);
        },
      });
  }

  protected receiptUnavailableReason(receipt: WarehouseReceipt): string {
    if (receipt.shipmentStatus !== 'DELIVERED') {
      return 'The backend permits receipt only after the shipment is marked DELIVERED.';
    }
    if (receipt.lines.some((line) => !line.purchaseOrderItemId)) {
      return 'The shipment is missing canonical purchase-order item IDs.';
    }
    return '';
  }

  protected canReceive(receipt: WarehouseReceipt): boolean {
    return receipt.status === 'PENDING' && !this.receiptUnavailableReason(receipt);
  }

  protected confirmPutAway(): void {
    const sku = this.adjustmentSku();
    if (!sku || this.putAwayForm.invalid) {
      this.putAwayForm.markAllAsTouched();
      return;
    }
    const stock = this.operations.stock().find((item) => item.sku === sku);
    if (!stock?.id) {
      this.error.set('Put-away is unavailable because the canonical stock-item ID is missing.');
      return;
    }
    const { location, quantity } = this.putAwayForm.getRawValue();
    this.saving.set(true);
    this.operations.putAwayStock(stock.id, location, quantity).subscribe({
      next: () => {
        this.adjustmentSku.set('');
        this.stockDialog.set('');
        this.feedback.set(`${quantity} units were saved to location ${location.trim()}.`);
        this.error.set('');
        this.inventory.refresh();
        this.operations.refreshPersistedWarehouseData('DISTRIBUTOR');
        this.saving.set(false);
      },
      error: (error) => {
        this.showError(error);
        this.saving.set(false);
      },
    });
  }

  protected confirmPick(): void {
    const order = this.selectedPickOrder();
    if (!order || this.pickForm.invalid) {
      this.pickForm.markAllAsTouched();
      return;
    }
    const { lineId, quantity } = this.pickForm.getRawValue();
    this.saving.set(true);
    this.operations.pickOrderItem(order.id, lineId, quantity).subscribe({
      next: () => {
        const next = this.operations.orders().find((item) => item.id === order.id);
        if (next?.status === 'READY_TO_PACK') this.selectedPickOrderId.set('');
        this.feedback.set(
          `Pick quantity was saved for ${order.orderNumber}.`,
        );
        this.error.set('');
        this.orderService.refresh();
        this.saving.set(false);
      },
      error: (error) => {
        this.showError(error);
        this.saving.set(false);
      },
    });
  }

  protected confirmPack(): void {
    const order = this.selectedPackOrder();
    if (!order || this.packForm.invalid) {
      this.packForm.markAllAsTouched();
      return;
    }
    const packages = this.packForm.controls.packages.value;
    this.saving.set(true);
    this.operations.packOrder(order.id, packages).subscribe({
      next: () => {
        this.selectedPackOrderId.set('');
        this.feedback.set(`${order.orderNumber} was packed by the backend and is ready for dispatch.`);
        this.error.set('');
        this.orderService.refresh();
        this.saving.set(false);
      },
      error: (error) => {
      this.showError(error);
        this.saving.set(false);
      },
    });
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
    const stock = this.operations.stock().find((item) => item.sku === sku);
    if (!stock?.id) {
      this.error.set('Inventory adjustment is unavailable because the canonical stock-item ID is missing.');
      return;
    }
    const { quantity, reason } = this.adjustmentForm.getRawValue();
    this.saving.set(true);
    this.operations.adjustStock(stock.id, quantity, reason).subscribe({
      next: () => {
        this.adjustmentSku.set('');
        this.stockDialog.set('');
        this.feedback.set(`Inventory adjustment recorded for ${sku}.`);
        this.error.set('');
        this.inventory.refresh();
        this.operations.refreshPersistedWarehouseData('DISTRIBUTOR');
        this.saving.set(false);
      },
      error: (error) => {
      this.showError(error);
        this.saving.set(false);
      },
    });
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
      this.operations.validateDispatchOrders(orderIds);
    } catch (error) {
      this.showError(error);
      return;
    }
    this.pendingTripId.set(candidate.trip.id);
    this.tripService.dispatch(candidate.trip.id).subscribe({
      next: () => {
        this.feedback.set(
          `${candidate.orders.map((order) => order.orderNumber).join(', ')} were dispatched on ${candidate.trip.tripNumber}.`,
        );
        this.error.set('');
        this.selectedTripId.set('');
        this.orderService.refresh();
        this.inventory.refresh();
        this.tripService.refresh();
        this.fleet.refresh();
        this.operations.refreshPersistedWarehouseData('DISTRIBUTOR');
        this.pendingTripId.set('');
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
    this.operations.refreshPersistedWarehouseData('DISTRIBUTOR');
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
