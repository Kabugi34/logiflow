import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DistributorCustomerService } from '../../customers/customer.service';
import { DistributorInventoryService } from '../../inventory/inventory.service';
import { DistributorOrderService } from '../order.service';
import { PaymentStatus } from '../order.models';

@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, ReactiveFormsModule, RouterLink],
  templateUrl: './order-form.component.html'
})
export class OrderFormComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly orderService = inject(DistributorOrderService);
  private readonly customerService = inject(DistributorCustomerService);
  protected readonly inventoryService = inject(DistributorInventoryService);
  protected readonly customers = this.customerService.customers;
  protected readonly errorMessage = signal('');
  protected readonly form = this.formBuilder.nonNullable.group({
    customerId: ['', Validators.required],
    paymentStatus: ['PENDING' as PaymentStatus, Validators.required],
    lines: this.formBuilder.nonNullable.array([this.createLine()])
  });
  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly selectedCustomer = computed(() => this.customerService.findById(this.formValue().customerId ?? ''));
  protected readonly orderTotal = computed(() => (this.formValue().lines ?? []).reduce((sum, line) => {
    const item = this.inventoryService.findBySku(line.sku ?? '');
    return sum + (item ? item.unitPrice * (line.quantity ?? 0) : 0);
  }, 0));

  protected get lines() {
    return this.form.controls.lines;
  }

  protected addLine(): void {
    this.lines.push(this.createLine());
  }

  protected removeLine(index: number): void {
    if (this.lines.length > 1) this.lines.removeAt(index);
  }

  protected submit(): void {
    this.errorMessage.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    try {
      const id = this.orderService.create(this.form.getRawValue());
      void this.router.navigate(['/distributor/orders', id], { queryParamsHandling: 'preserve' });
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to create this order.');
    }
  }

  private createLine() {
    return this.formBuilder.nonNullable.group({
      sku: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1), Validators.max(100000)]]
    });
  }
}
