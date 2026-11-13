import { Component, computed, inject } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ManufacturerProductService } from '../product.service';
import { AuthenticatedImageComponent } from '../../../../shared/authenticated-image.component';

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [AuthenticatedImageComponent, CurrencyPipe, DecimalPipe, RouterLink],
  templateUrl: './product-details.component.html',
})
export class ProductDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly productService = inject(ManufacturerProductService);
  protected readonly product = computed(() =>
    this.productService.findBySku(this.route.snapshot.paramMap.get('sku') ?? ''),
  );
}
