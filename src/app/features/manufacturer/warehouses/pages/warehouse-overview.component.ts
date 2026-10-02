import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { WarehouseCardComponent } from '../components/warehouse-card/warehouse-card.component';
import { WarehouseDetailsComponent } from '../components/warehouse-details/warehouse-details.component';
import { ManufacturerWarehouseService } from '../warehouse.service';

@Component({
  selector: 'app-warehouse-overview',
  standalone: true,
  imports: [RouterLink, WarehouseCardComponent, WarehouseDetailsComponent],
  templateUrl: './warehouse-overview.component.html'
})
export class WarehouseOverviewComponent {
  private readonly warehouseService = inject(ManufacturerWarehouseService);
  protected readonly warehouses = this.warehouseService.warehouses;
  protected readonly selectedWarehouseId = signal<string | null>('NBO-A1');
  protected readonly selectedWarehouse = computed(() => {
    const id = this.selectedWarehouseId();
    return id ? this.warehouseService.findById(id) ?? null : null;
  });

  protected selectWarehouse(id: string): void {
    this.selectedWarehouseId.set(id);
  }

  protected closeDetails(): void {
    this.selectedWarehouseId.set(null);
  }
}
