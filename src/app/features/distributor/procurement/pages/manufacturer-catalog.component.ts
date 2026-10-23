import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DistributorProcurementService } from '../procurement.service';

@Component({
  selector: 'app-manufacturer-catalog',
  imports: [CurrencyPipe, DecimalPipe, RouterLink],
  templateUrl: './manufacturer-catalog.component.html',
})
export class ManufacturerCatalogComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly procurement = inject(DistributorProcurementService);
  protected readonly manufacturerId = this.route.snapshot.paramMap.get('manufacturerId') ?? '';
  protected readonly manufacturer = this.procurement.findManufacturer(this.manufacturerId);
  protected readonly products = computed(() =>
    this.procurement.productsForManufacturer(this.manufacturerId),
  );

  protected unitCost(sku: string): number {
    return this.procurement.indicativeUnitCost(sku);
  }
}
