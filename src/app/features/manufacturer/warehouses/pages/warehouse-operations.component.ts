import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
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
import { ManufacturerInventoryService } from '../../inventory/inventory.service';
import { ManufacturerPurchaseOrderService } from '../../purchase-orders/purchase-order.service';
import { ManufacturerShipmentService } from '../../shipments/shipment.service';

@Component({
  selector: 'app-manufacturer-warehouse-operations',
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './warehouse-operations.component.html',
})
export class ManufacturerWarehouseOperationsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  protected readonly operations = inject(WarehouseOperationsService);
  protected readonly inventory = inject(ManufacturerInventoryService);
  protected readonly purchaseOrders = inject(ManufacturerPurchaseOrderService);
  protected readonly shipments = inject(ManufacturerShipmentService);
  ngOnInit(): void {
    this.purchaseOrders.refresh();
    this.shipments.refresh();
  }

  private readonly sourceSync = effect(() => {
    if (this.inventory.loading() || this.purchaseOrders.loading()) return;
    const inventory = this.inventory.getRows().map((item) => ({
      id: item.id,
      sku: item.sku,
      name: item.productName,
      onHand: item.totalStock,
    }));
    const orders = this.purchaseOrders.orders().map((order) => ({
      id: order.id,
      orderNumber: order.id,
      receivingOrganization: order.distributorName,
      destinationWarehouseId: order.destinationWarehouseId,
      status: order.status,
      paymentStatus: order.paymentStatus,
      lines: order.lines.map((line) => ({
        sku: line.sku,
        product: line.productName,
        quantity: line.requestedQuantity,
      })),
    }));
    untracked(() => this.operations.synchronize(inventory, orders, 'MANUFACTURER'));
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
    this.error.set(
      'Put-away is unavailable for manufacturer stock: the backend location API permits distributor roles only.',
    );
    if (!this.adjustmentSku() || this.putAwayForm.invalid) {
      this.putAwayForm.markAllAsTouched();
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
    const stock = this.operations.stock().find((item) => item.sku === this.adjustmentSku());
    if (!stock?.id) {
      this.error.set('Inventory adjustment is unavailable because the canonical stock-item ID is missing.');
      return;
    }
    const { quantity, reason } = this.adjustmentForm.getRawValue();
    const sku = this.adjustmentSku();
    this.saving.set(true);
    this.operations.adjustStock(stock.id, quantity, reason).subscribe({
      next: () => {
      this.stockDialog.set('');
      this.adjustmentSku.set('');
      this.feedback.set(`Inventory adjustment recorded for ${sku}.`);
      this.error.set('');
      this.inventory.refresh();
      this.operations.refreshPersistedWarehouseData('MANUFACTURER');
      this.saving.set(false);
      },
      error: (error) => {
      this.showError(error);
      this.saving.set(false);
      },
    });
  }

  protected openPick(order: WarehouseOrder): void {
    this.clearFeedback();
    this.selectedPickOrderId.set(order.id);
    this.pickForm.reset({ lineId: order.lines[0]?.id ?? '', quantity: 1 });
  }

  protected confirmPick(): void {
    this.error.set(
      'Picking is unavailable for manufacturer purchase orders: the backend warehouse pick API accepts distributor customer orders only and these PO lines have no canonical order-item IDs.',
    );
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
    this.error.set(
      'Packing is unavailable for manufacturer purchase orders: the backend warehouse pack API accepts distributor customer orders only.',
    );
  }

  protected openDispatch(order: WarehouseOrder): void {
    this.clearFeedback();
    this.selectedDispatchOrderId.set(order.id);
  }

  protected shipmentForOrder(orderId: string) {
    return this.shipments.findByPurchaseOrderId(orderId);
  }

  protected confirmDispatch(): void {
    const order = this.selectedDispatchOrder();
    if (!order || this.saving()) return;
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
    const shipment = this.shipments.findByPurchaseOrderId(purchaseOrder.id);
    if (!shipment || shipment.status !== 'READY_FOR_DISPATCH') {
      this.error.set('Create a shipment for this paid purchase order in Shipments before dispatching it.');
      return;
    }

    this.saving.set(true);
    this.shipments
      .updateStatus(shipment.id, 'IN_TRANSIT')
      .subscribe({
        next: (shipment) => {
          this.feedback.set(
            `Shipment ${shipment.id} was dispatched. Assign a driver and vehicle through trip operations if needed.`,
          );
          this.error.set('');
          this.selectedDispatchOrderId.set('');
          this.inventory.refresh();
          this.purchaseOrders.refresh();
          this.shipments.refresh();
          this.operations.refreshPersistedWarehouseData('MANUFACTURER');
          this.saving.set(false);
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
    this.operations.refreshPersistedWarehouseData('MANUFACTURER');
  }

  private clearFeedback(): void {
    this.feedback.set('');
    this.error.set('');
  }

  private showError(error: unknown, fallback = 'Warehouse operation failed.'): void {
    this.error.set(error instanceof Error ? error.message : fallback);
  }
}
