import { FormValidationSummaryComponent } from '../../../shared/forms/form-validation-summary.component';
import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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

  protected readonly form = this.formBuilder.nonNullable.group({
    organizationType: ['MANUFACTURER' as OrganizationType, Validators.required],
    organizationName: ['', [trimmedRequired, Validators.minLength(2), Validators.maxLength(120)]],
    contactName: ['', [trimmedRequired, personName, Validators.maxLength(80)]],
    contactEmail: ['', [trimmedRequired, Validators.email, Validators.maxLength(120)]],
    organizationEmail: ['', [trimmedRequired, Validators.email, Validators.maxLength(120)]],
    phoneNumber: ['', [trimmedRequired, internationalPhone, Validators.maxLength(32)]],
  });

  protected submit(): void {
    if (this.isSubmitting() || this.submitted()) return;

    this.errorMessage.set('');
    this.successMessage.set('');
    this.submitted.set(false);
    this.duplicateContactEmail.set(false);
    this.duplicateOrganizationEmail.set(false);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Please complete all required fields correctly.');
      return;
    }

    const payload = this.form.getRawValue();
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
