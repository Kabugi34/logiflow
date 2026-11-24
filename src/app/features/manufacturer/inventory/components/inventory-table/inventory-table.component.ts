import { DecimalPipe } from '@angular/common';
import { Component, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InventoryRow } from '../../inventory.models';
import { ManufacturerWarehouse } from '../../../warehouses/warehouse.models';

@Component({
  selector: 'app-inventory-table',
  standalone: true,
  imports: [DecimalPipe, RouterLink],
  templateUrl: './inventory-table.component.html'
})
export class InventoryTableComponent {
  readonly rows = input.required<InventoryRow[]>();
  readonly warehouses = input.required<ManufacturerWarehouse[]>();
  readonly associate = output<{ stockItemId: string; warehouseId: string }>();
  readonly intake = output<{ stockItemId: string; quantity: number; sourceReference: string }>();
  readonly movements = output<string>();
  protected readonly selectedWarehouses = signal<Record<string, string>>({});
  protected readonly quantities = signal<Record<string, number>>({});
  protected readonly references = signal<Record<string, string>>({});

  protected selectWarehouse(id: string, event: Event): void {
    this.selectedWarehouses.update(rows => ({ ...rows, [id]: (event.target as HTMLSelectElement).value }));
  }
  protected setQuantity(id: string, event: Event): void {
    this.quantities.update(rows => ({ ...rows, [id]: Number((event.target as HTMLInputElement).value) }));
  }
  protected setReference(id: string, event: Event): void {
    this.references.update(rows => ({ ...rows, [id]: (event.target as HTMLInputElement).value }));
  }
}
