import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ManufacturerInventoryService } from '../inventory.service';
import { InventoryTableComponent } from '../components/inventory-table/inventory-table.component';
import { LoadingSkeletonComponent } from '../../../../shared/loading/loading-skeleton.component';
import { StockMovementRecord } from '../inventory.models';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-inventory-center',
  standalone: true,
  imports: [LoadingSkeletonComponent, RouterLink, InventoryTableComponent],
  templateUrl: './inventory-center.component.html'
})
export class InventoryCenterComponent {
  protected readonly inventoryService = inject(ManufacturerInventoryService);
  protected readonly selectedCategory = signal('All categories');
  protected readonly selectedTerminalId = signal(this.inventoryService.getTerminalId());
  protected readonly categories = computed(() => this.inventoryService.getCategories());
  protected readonly rows = computed(() => this.inventoryService.getRows(this.selectedCategory()));
  protected readonly auditRequested = this.inventoryService.auditRequestSubmitted.asReadonly();
  protected readonly auditMessage = signal('');
  protected readonly operationMessage = signal('');
  protected readonly operationBusy = signal(false);
  protected readonly movementRows = signal<StockMovementRecord[]>([]);
  protected readonly movementItemId = signal('');

  protected selectTerminal(event: Event): void {
    const terminalId = (event.target as HTMLSelectElement).value;
    this.selectedTerminalId.set(terminalId);
    this.inventoryService.setTerminal(terminalId);
  }

  protected selectCategory(event: Event): void {
    this.selectedCategory.set((event.target as HTMLSelectElement).value);
  }

  protected requestAudit(): void {
    this.auditMessage.set('');
    this.inventoryService.requestAudit().subscribe({
      next: () => this.auditMessage.set('Stock audit request submitted.'),
      error: error => this.auditMessage.set(error?.error?.message ?? 'Stock audit request could not be submitted.')
    });
  }

  protected associateWarehouse(event: { stockItemId: string; warehouseId: string }): void {
    if (!event.warehouseId || this.operationBusy()) return;
    this.operationBusy.set(true); this.operationMessage.set('');
    try {
      this.inventoryService.associateWarehouse(event.stockItemId, event.warehouseId)
        .pipe(finalize(() => this.operationBusy.set(false))).subscribe({
          next: () => { this.operationMessage.set('Stock item associated with the selected warehouse.'); this.inventoryService.warehouseService.refresh(); },
          error: e => this.operationMessage.set(e?.error?.message ?? 'Warehouse association failed.'),
        });
    } catch (e) { this.operationBusy.set(false); this.operationMessage.set(e instanceof Error ? e.message : 'Warehouse association failed.'); }
  }

  protected recordIntake(event: { stockItemId: string; quantity: number; sourceReference: string }): void {
    if (this.operationBusy()) return;
    this.operationBusy.set(true); this.operationMessage.set('');
    try {
      this.inventoryService.intake(event.stockItemId, event.quantity, event.sourceReference, '')
        .pipe(finalize(() => this.operationBusy.set(false))).subscribe({
          next: result => this.operationMessage.set(`Intake ${result.movementId} confirmed: ${result.quantityReceived} received; ${result.quantityOnHand} on hand, ${result.reservedQuantity} reserved, ${result.availableQuantity} available (${result.status}).`),
          error: e => this.operationMessage.set(e?.error?.message ?? 'Production intake failed.'),
        });
    } catch (e) { this.operationBusy.set(false); this.operationMessage.set(e instanceof Error ? e.message : 'Production intake failed.'); }
  }

  protected showMovements(stockItemId: string): void {
    this.movementItemId.set(stockItemId); this.movementRows.set([]);
    this.inventoryService.loadMovements(stockItemId).subscribe({
      next: response => this.movementRows.set(Array.isArray(response) ? response : (response as unknown as { content?: StockMovementRecord[] }).content ?? []),
      error: e => this.operationMessage.set(e?.error?.message ?? 'Movement history could not be loaded.'),
    });
  }
}
