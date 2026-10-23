import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const trimmedRequired: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  String(control.value ?? '').trim().length ? null : { required: true };

/** Accepts international E.164 numbers with optional common visual separators. */
export const internationalPhone: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  if (!value) return null; // pair with Validators.required
  if (!value.startsWith('+')) return { internationalPhone: true };
  const digits = value.slice(1).replace(/[\s().-]/g, '');
  return /^\+[1-9]/.test(value) && /^\d{8,15}$/.test(digits) ? null : { internationalPhone: true };
};

export const personName: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  if (!value) return null; // pair with trimmedRequired
  return /^[\p{L}][\p{L}\p{M} .'-]*$/u.test(value) ? null : { personName: true };
};

export const licenceValue: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  if (!value) return null; // pair with trimmedRequired
  return /^[A-Za-z0-9][A-Za-z0-9 /-]{1,39}$/.test(value) ? null : { licenceValue: true };
};

export const matchingFields =
  (first: string, second: string): ValidatorFn =>
  (control: AbstractControl): ValidationErrors | null => {
    const firstValue = control.get(first)?.value;
    const secondValue = control.get(second)?.value;
    return firstValue === secondValue ? null : { passwordMismatch: true };
  };
