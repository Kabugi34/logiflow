import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormValidationSummaryComponent } from '../forms/form-validation-summary.component';
import { kenyanRegistrationNumber, normalizeKenyanRegistrationNumber, trimmedRequired } from '../../core/forms/form-validators';

export interface VehicleRegistrationDetails {
  plate: string;
  type: string;
  maxWeightCapacity: number;
}

@Component({
  selector: 'app-vehicle-registration-dialog',
  standalone: true,
  imports: [FormValidationSummaryComponent, ReactiveFormsModule],
  template: `
    @if (open) {
      <div class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4" (click)="closed.emit()" (keydown.escape)="closed.emit()">
        <section role="dialog" aria-modal="true" aria-labelledby="register-vehicle-title" class="my-auto w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-xl" (click)="$event.stopPropagation()">
          <div class="flex items-start justify-between gap-4"><div><h2 id="register-vehicle-title" class="text-base font-semibold text-slate-900">Register vehicle</h2><p class="mt-1 text-xs text-slate-500">Add a vehicle to your organization fleet.</p></div><button type="button" (click)="closed.emit()" aria-label="Close dialog" class="grid h-7 w-7 place-items-center rounded text-lg text-slate-500 hover:bg-slate-100">×</button></div>
          <form [formGroup]="form" (ngSubmit)="submit()" class="mt-4 space-y-3"><app-form-validation-summary [form]="form" />
            <label class="block space-y-1"><span class="text-xs font-medium text-slate-700">Registration plate</span><input formControlName="plate" placeholder="KEA 090Y" class="h-9 w-full rounded-md border border-slate-200 px-3 text-xs"></label>
            <label class="block space-y-1"><span class="text-xs font-medium text-slate-700">Vehicle type</span><input formControlName="type" placeholder="Isuzu NQR 4T" class="h-9 w-full rounded-md border border-slate-200 px-3 text-xs"></label>
            <label class="block space-y-1"><span class="text-xs font-medium text-slate-700">Maximum weight capacity (lbs)</span><input type="number" min="1" formControlName="maxWeightCapacity" class="h-9 w-full rounded-md border border-slate-200 px-3 text-xs"></label>
            @if (error) { <p role="alert" class="text-xs text-red-600">{{ error }}</p> }
            <div class="flex justify-end gap-2 pt-2"><button type="button" (click)="closed.emit()" class="h-9 rounded-md border border-slate-200 px-3 text-xs font-medium text-slate-700">Cancel</button><button type="submit" [disabled]="saving" class="h-9 rounded-md bg-blue-600 px-3 text-xs font-medium text-white disabled:opacity-60">{{ saving ? 'Saving…' : 'Register vehicle' }}</button></div>
          </form>
        </section>
      </div>
    }
  `,
})
export class VehicleRegistrationDialogComponent {
  @Input() open = false;
  @Input() saving = false;
  @Input() error = '';
  @Output() closed = new EventEmitter<void>();
  @Output() registered = new EventEmitter<VehicleRegistrationDetails>();
  private readonly fb = new FormBuilder();
  protected readonly form = this.fb.nonNullable.group({
    plate: ['', [trimmedRequired, kenyanRegistrationNumber]],
    type: ['', [trimmedRequired, Validators.maxLength(80)]],
    maxWeightCapacity: [26000, [Validators.required, Validators.min(1)]],
  });

  submit(): void {
    if (this.saving) return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    this.registered.emit({ ...value, plate: normalizeKenyanRegistrationNumber(value.plate) });
  }
}
