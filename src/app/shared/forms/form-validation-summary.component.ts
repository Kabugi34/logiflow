import { Component, input } from '@angular/core';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-form-validation-summary',
  standalone: true,
  template: `
    @if (messages().length) {
      <div
        role="alert"
        aria-live="polite"
        class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
      >
        <p class="font-semibold">Please correct the following fields:</p>
        <ul class="mt-1 list-inside list-disc space-y-0.5">
          @for (message of messages(); track message) {
            <li>{{ message }}</li>
          }
        </ul>
      </div>
    }
  `,
})
export class FormValidationSummaryComponent {
  readonly form = input.required<AbstractControl>();

  protected messages(): string[] {
    const result: string[] = [];
    const visit = (control: AbstractControl, path: string): void => {
      if (control instanceof FormGroup) {
        for (const [key, child] of Object.entries(control.controls))
          visit(child, this.label(path ? `${path}.${key}` : key));
      } else if (control instanceof FormArray) {
        control.controls.forEach((child, index) => visit(child, `${path} ${index + 1}`));
      } else if (control.invalid && (control.touched || control.dirty)) {
        const error = control.errors ?? {};
        let reason = '';
        if (error['required']) reason = 'is required';
        else if (error['email']) reason = 'must be a valid email address';
        else if (error['minlength'])
          reason = `must contain at least ${error['minlength'].requiredLength} characters`;
        else if (error['maxlength'])
          reason = `must contain no more than ${error['maxlength'].requiredLength} characters`;
        else if (error['min']) reason = `must be at least ${error['min'].min}`;
        else if (error['max']) reason = `must be no more than ${error['max'].max}`;
        else if (error['pattern']) reason = 'does not match the required format';
        else if (error['internationalPhone'])
          reason = 'must include a valid international country code';
        else if (error['personName']) reason = 'contains unsupported characters';
        else if (error['licenceValue'])
          reason = 'must be 2 to 40 letters, numbers, spaces, slashes, or hyphens';
        else if (error['requiredTrue']) reason = 'must be accepted';
        if (reason) result.push(`${path} ${reason}.`);
      }
      if (
        !(control instanceof FormGroup) &&
        !(control instanceof FormArray) &&
        control.errors &&
        (control.touched || control.dirty)
      ) {
        const groupErrors = control.errors;
        if (groupErrors['passwordMismatch']) result.push('Passwords must match.');
      }
    };
    const rootErrors = this.form().errors ?? {};
    if (rootErrors['passwordMismatch'] && (this.form().touched || this.form().dirty))
      result.push('Passwords must match.');
    visit(this.form(), '');
    return [...new Set(result)];
  }

  private label(path: string): string {
    return path
      .split('.')
      .map((part) =>
        part.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\b\w/g, (letter) => letter.toUpperCase()),
      )
      .join(' ');
  }
}
