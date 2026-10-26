import { FormValidationSummaryComponent } from '../../../shared/forms/form-validation-summary.component';
import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { LoadingIndicatorComponent } from '../../../shared/loading/loading-indicator.component';
import { OrganizationType } from '../../../core/models/organization.model';
import {
  internationalPhone,
  personName,
  trimmedRequired,
} from '../../../core/forms/form-validators';
import { finalize } from 'rxjs';
import { countryFlag as getCountryFlag, PHONE_COUNTRY_CODES } from '../../../core/forms/phone-country-codes';

@Component({
  selector: 'app-request-access',
  standalone: true,
  imports: [FormValidationSummaryComponent, LoadingIndicatorComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './request-access.component.html',
})
export class RequestAccessComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly submitted = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly submittedEmail = signal('');
  protected readonly duplicateContactEmail = signal(false);
  protected readonly duplicateOrganizationEmail = signal(false);
  protected readonly documentErrors = signal<Record<string, string>>({});
  protected readonly phoneCountries = PHONE_COUNTRY_CODES;

  private readonly documentValidator = (control: AbstractControl): ValidationErrors | null => {
    const file = control.value as File | null;
    if (!file) return { required: true };
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) return { documentType: true };
    return file.size > 5 * 1024 * 1024 ? { documentSize: true } : null;
  };

  protected readonly form = this.formBuilder.nonNullable.group({
    organizationType: ['MANUFACTURER' as OrganizationType, Validators.required],
    organizationName: ['', [trimmedRequired, Validators.minLength(2), Validators.maxLength(120)]],
    contactName: ['', [trimmedRequired, personName, Validators.maxLength(80)]],
    representativeRole: ['', [trimmedRequired, Validators.maxLength(80)]],
    country: ['Kenya', [trimmedRequired, Validators.maxLength(80)]],
    registrationNumber: ['', [trimmedRequired, Validators.maxLength(80)]],
    taxIdentifier: ['', [trimmedRequired, Validators.maxLength(80)]],
    contactEmail: ['', [trimmedRequired, Validators.email, Validators.maxLength(120)]],
    organizationEmail: ['', [trimmedRequired, Validators.email, Validators.maxLength(120)]],
    phoneCountry: ['Kenya', Validators.required],
    phoneSubscriber: ['', [trimmedRequired, Validators.pattern(/^[0-9\s().-]{6,18}$/)]],
    phoneNumber: ['', [trimmedRequired, internationalPhone, Validators.maxLength(32)]],
    incorporationCertificate: [null as File | null, this.documentValidator],
    taxCertificate: [null as File | null, this.documentValidator],
    authorizedRepresentative: [false, Validators.requiredTrue],
  });

  protected selectDocument(field: 'incorporationCertificate' | 'taxCertificate', event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const control = this.form.controls[field];
    control.setValue(file);
    control.markAsTouched();
    control.updateValueAndValidity();
    const errors = { ...this.documentErrors() };
    if (!file) errors[field] = 'Choose a document to continue.';
    else if (file.size > 5 * 1024 * 1024) errors[field] = 'The file must be 5 MB or smaller.';
    else if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) errors[field] = 'Use a PDF, JPG, or PNG file.';
    else delete errors[field];
    this.documentErrors.set(errors);
  }

  protected selectedFileName(field: 'incorporationCertificate' | 'taxCertificate'): string {
    return this.form.controls[field].value?.name ?? 'No file selected';
  }

  protected updatePhoneNumber(): void {
    const countryCode = this.phoneCountries.find((country) => country.name === this.form.controls.phoneCountry.value)?.code ?? '';
    const subscriberDigits = this.form.controls.phoneSubscriber.value.replace(/\D/g, '').replace(/^0+/, '');
    this.form.controls.phoneNumber.setValue(subscriberDigits ? `${countryCode}${subscriberDigits}` : '');
    this.form.controls.phoneNumber.updateValueAndValidity();
  }

  protected phoneCountryFlag(): string {
    return getCountryFlag(this.form.controls.phoneCountry.value);
  }

  protected countryFlagFor(countryName: string): string { return getCountryFlag(countryName); }

  protected submit(): void {
    if (this.isSubmitting() || this.submitted()) return;
    this.updatePhoneNumber();

    this.errorMessage.set('');
    this.successMessage.set('');
    this.submitted.set(false);
    this.duplicateContactEmail.set(false);
    this.duplicateOrganizationEmail.set(false);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      for (const field of ['incorporationCertificate', 'taxCertificate'] as const) {
        const control = this.form.controls[field];
        if (!control.value) this.documentErrors.update((errors) => ({ ...errors, [field]: 'Choose a document to continue.' }));
      }
      this.errorMessage.set('Please complete all required fields correctly.');
      return;
    }

    const { phoneCountry: _country, phoneSubscriber: _subscriber, ...values } = this.form.getRawValue();
    const payload = {
      ...values,
      incorporationCertificate: values.incorporationCertificate!,
      taxCertificate: values.taxCertificate!,
    };
    this.submittedEmail.set(payload.contactEmail.trim());
    this.isSubmitting.set(true);
    this.authService.requestAccess(payload).pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
      next: () => {
        this.successMessage.set(
          `Your request has been submitted for review. If approved, the invitation link will be sent to ${this.submittedEmail()}.`,
        );
        this.submitted.set(true);
      },
      error: (error) => {
        this.setRequestError(error);
      },
    });
  }

  private setRequestError(error: unknown): void {
    if (!(error instanceof HttpErrorResponse)) {
      this.errorMessage.set('Unable to submit your request right now. Please try again.');
      return;
    }

    const body =
      typeof error.error === 'object' && error.error !== null
        ? (error.error as Record<string, unknown>)
        : {};
    const code = typeof body['code'] === 'string' ? body['code'].toLowerCase() : '';
    const field = typeof body['field'] === 'string' ? body['field'].toLowerCase() : '';
    const message = typeof body['message'] === 'string' ? body['message'].toLowerCase() : '';
    const detail = `${code} ${field} ${message}`;
    const duplicate =
      detail.includes('duplicate') ||
      detail.includes('already') ||
      detail.includes('exists') ||
      error.status === 409;

    if (
      detail.includes('contactemail') ||
      detail.includes('personalemail') ||
      detail.includes('personal email') ||
      detail.includes('user_email') ||
      (duplicate && (detail.includes('contact email') || detail.includes('user email')))
    ) {
      this.duplicateContactEmail.set(true);
      return;
    }
    if (
      detail.includes('organizationemail') ||
      detail.includes('organization email') ||
      detail.includes('org_email') ||
      (duplicate && detail.includes('org email'))
    ) {
      this.duplicateOrganizationEmail.set(true);
      return;
    }
    if (duplicate && detail.includes('email')) {
      this.duplicateContactEmail.set(true);
      return;
    }

    this.errorMessage.set(
      duplicate
        ? 'An application with these details already exists. Check the email fields or contact LogiFlow support.'
        : 'Unable to submit your request right now. Please check your details and try again.',
    );
  }
}
