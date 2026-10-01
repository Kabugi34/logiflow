import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { OrganizationType } from '../../../core/models/organization.model';

@Component({
  selector: 'app-request-access',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './request-access.component.html'
})
export class RequestAccessComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');

  protected readonly form = this.formBuilder.nonNullable.group({
    organizationType: ['MANUFACTURER' as OrganizationType, Validators.required],
    organizationName: ['', [Validators.required, Validators.minLength(2)]],
    contactName: ['', [Validators.required, Validators.minLength(2)]],
    contactEmail: ['', [Validators.required, Validators.email]],
    organizationEmail: ['', [Validators.required, Validators.email]],
    phoneNumber: ['', [Validators.required, Validators.pattern(/^\+?[0-9\s\-()]{7,20}$/)]]
  });

  protected submit(): void {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Please complete all required fields correctly.');
      return;
    }

    try {
      const request = this.authService.requestAccess(this.form.getRawValue());
      this.successMessage.set(`Your access request was submitted. Use the OTP ${request.invitationOtp} to activate your account.`);

      void this.router.navigate(['/auth/activate'], {
        queryParams: {
          email: request.contactEmail,
          organizationEmail: request.organizationEmail,
          organizationType: request.organizationType,
          otp: request.invitationOtp
        }
      });
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to submit your request right now.');
    }
  }
}
