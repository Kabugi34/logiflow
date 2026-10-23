import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DistributorProcurementService } from '../procurement.service';

@Component({
  selector: 'app-manufacturers-network',
  imports: [RouterLink],
  templateUrl: './manufacturers-network.component.html',
})
export class ManufacturersNetworkComponent {
  protected readonly procurement = inject(DistributorProcurementService);
  protected readonly searchTerm = signal('');
  protected readonly manufacturers = computed(() => {
    const query = this.searchTerm().trim().toLowerCase();
    return this.procurement
      .manufacturers()
      .filter(
        (manufacturer) =>
          !query ||
          [manufacturer.name, manufacturer.location].some((value) =>
            value.toLowerCase().includes(query),
          ),
      );
  });

  protected productCount(manufacturerId: string): number {
    return this.procurement.productsForManufacturer(manufacturerId).length;
  }

  protected orderCount(manufacturerId: string): number {
    return this.procurement
      .orders()
      .filter((order) => order.manufacturerId === manufacturerId && order.status !== 'DELIVERED')
      .length;
  }

  protected updateSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }
}
