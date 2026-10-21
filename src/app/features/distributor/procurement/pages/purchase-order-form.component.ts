import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DistributorProcurementService } from '../procurement.service';
import { DraftProcurementLine } from '../procurement.models';

interface DraftLineView extends DraftProcurementLine {
  productName: string;
  unit: string;
  unitCost: number;
}

@Component({
  selector: 'app-purchase-order-form',
  imports: [CurrencyPipe, DecimalPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './purchase-order-form.component.html'
})
export class PurchaseOrderFormComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly procurement = inject(DistributorProcurementService);
  protected readonly manufacturerId = signal(this.route.snapshot.queryParamMap.get('manufacturer') ?? '');
  protected readonly selectedManufacturer = computed(() => this.procurement.findManufacturer(this.manufacturerId()));
  protected readonly products = computed(() => this.procurement.productsForManufacturer(this.manufacturerId()));
  protected readonly lines = signal<DraftLineView[]>([]);
  protected readonly errorMessage = signal('');
  protected readonly form = this.formBuilder.nonNullable.group({
    sku: ['', Validators.required],
    quantity: [1, [Validators.required, Validators.min(1)]]
  });
  protected readonly subtotal = computed(() => this.lines().reduce((sum, line) => sum + line.quantity * line.unitCost, 0));

  constructor() {
    effect(() => {
      const firstSupplier = this.procurement.manufacturers()[0];
      if (!this.manufacturerId() && firstSupplier) this.manufacturerId.set(firstSupplier.id);
    });
  }

  protected updateManufacturer(event: Event): void {
    this.manufacturerId.set((event.target as HTMLSelectElement).value);
    this.lines.set([]);
    const firstProduct = this.products()[0];
    this.form.reset({ sku: firstProduct?.sku ?? '', quantity: 1 });
    this.errorMessage.set('');
  }

  protected addLine(): void {
    this.errorMessage.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const product = this.products().find(item => item.sku === this.form.controls.sku.value);
    if (!product) {
      this.errorMessage.set('Choose a product from the selected manufacturer.');
      return;
    }
    const quantity = this.form.controls.quantity.value;
    const line: DraftLineView = { sku: product.sku, productName: product.name, quantity, unit: product.unit, unitCost: this.procurement.indicativeUnitCost(product.sku) };
    this.lines.update(lines => {
      const existing = lines.find(item => item.sku === line.sku);
      return existing
        ? lines.map(item => item.sku === line.sku ? { ...item, quantity: item.quantity + quantity } : item)
        : [...lines, line];
    });
    this.form.controls.quantity.setValue(1);
  }

  protected removeLine(sku: string): void {
    this.lines.update(lines => lines.filter(line => line.sku !== sku));
  }

  protected createDraft(): void {
    this.errorMessage.set('');
    if (!this.lines().length) {
      this.errorMessage.set('Add at least one product before creating the purchase order.');
      return;
    }
    try {
      this.procurement.createDraft(this.manufacturerId(), this.lines().map(({ sku, quantity }) => ({ sku, quantity }))).subscribe({
        next: id => void this.router.navigate(['/distributor/procurement', id], { queryParamsHandling: 'preserve' }),
        error: error => this.errorMessage.set(error?.error?.message ?? error?.message ?? 'Unable to create the purchase order.')
      });
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to create this purchase order.');
    }
  }

  protected lineTotal(line: DraftLineView): number {
    return line.quantity * line.unitCost;
  }

}
