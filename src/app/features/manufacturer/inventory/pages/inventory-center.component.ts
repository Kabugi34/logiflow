import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ManufacturerInventoryService } from '../inventory.service';
import { InventoryTableComponent } from '../components/inventory-table/inventory-table.component';

@Component({
  selector: 'app-inventory-center',
  standalone: true,
  imports: [RouterLink, InventoryTableComponent],
  templateUrl: './inventory-center.component.html'
})
export class InventoryCenterComponent {
  protected readonly inventoryService = inject(ManufacturerInventoryService);
  protected readonly selectedCategory = signal('All categories');
  protected readonly selectedTerminalId = signal(this.inventoryService.getTerminalId());
  protected readonly categories = this.inventoryService.getCategories();
  protected readonly rows = computed(() => this.inventoryService.getRows(this.selectedCategory()));
  protected readonly auditRequested = this.inventoryService.auditRequestSubmitted.asReadonly();

  protected selectTerminal(event: Event): void {
    const terminalId = (event.target as HTMLSelectElement).value;
    this.selectedTerminalId.set(terminalId);
    this.inventoryService.setTerminal(terminalId);
  }

  protected selectCategory(event: Event): void {
    this.selectedCategory.set((event.target as HTMLSelectElement).value);
  }

  protected requestAudit(): void {
    this.inventoryService.requestAudit();
  }
}
