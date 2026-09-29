import { Component, computed, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ManufacturerProductService } from '../product.service';

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [DecimalPipe, RouterLink],
  templateUrl: './product-details.component.html'
})
export class ProductDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly productService = inject(ManufacturerProductService);
  protected readonly product = computed(() => this.productService.findBySku(this.route.snapshot.paramMap.get('sku') ?? ''));
}
