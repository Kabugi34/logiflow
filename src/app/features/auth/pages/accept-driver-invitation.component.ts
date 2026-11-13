import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthApiService } from '../../../core/auth/auth-api.service';
import { internationalPhone, trimmedRequired } from '../../../core/forms/form-validators';
import { DriverInvitationDetails } from '../../../core/models/driver-invitation.model';
import { BrandLogoComponent } from '../../../shared/brand-logo.component';
import { FormValidationSummaryComponent } from '../../../shared/forms/form-validation-summary.component';
import { LoadingIndicatorComponent } from '../../../shared/loading/loading-indicator.component';

type InvitationState = 'LOADING' | 'READY' | 'INVALID' | 'EXPIRED' | 'USED' | 'ERROR' | 'OTP' | 'VERIFIED';

@Component({
  selector: 'app-accept-driver-invitation',
  standalone: true,
  imports: [
    BrandLogoComponent,
    CommonModule,
    FormValidationSummaryComponent,
    LoadingIndicatorComponent,
    ReactiveFormsModule,
  ],
  templateUrl: './accept-driver-invitation.component.html',
})
export class AcceptDriverInvitationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly authApi = inject(AuthApiService);

  protected readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  protected readonly state = signal<InvitationState>(this.token ? 'LOADING' : 'INVALID');
  protected readonly details = signal<DriverInvitationDetails | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly statusMessage = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly identifier = signal('');

  private readonly passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;

  protected readonly acceptForm = this.fb.nonNullable.group({
    phoneNumber: ['', [trimmedRequired, internationalPhone, Validators.maxLength(20)]],
    password: ['', [Validators.required, Validators.pattern(this.passwordPattern)]],
  });

  protected readonly otpForm = this.fb.nonNullable.group({
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  constructor() {
    if (this.token) this.loadInvitation();
  }

  protected loadInvitation(): void {
    if (!this.token) {
      this.state.set('INVALID');
      return;
    }

    this.errorMessage.set('');
    this.state.set('LOADING');
    this.authApi.getDriverInvitation(this.token).subscribe({
      next: (details) => {
        this.details.set(details);
        if (details.status !== 'PENDING') {
          this.state.set(details.status === 'EXPIRED' ? 'EXPIRED' : 'USED');
          return;
        }
        this.state.set('READY');
      },
      error: (error) => this.setInvitationError(error),
    });
  }

  protected accept(): void {
    if (this.isSubmitting() || this.state() !== 'READY') return;
    this.errorMessage.set('');
    if (this.acceptForm.invalid) {
      this.acceptForm.markAllAsTouched();
      return;
    }

    const { phoneNumber, password } = this.acceptForm.getRawValue();
    this.identifier.set(phoneNumber.trim());
    this.isSubmitting.set(true);
    this.authApi
      .acceptDriverInvitation(this.token, { phoneNumber, password })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.otpForm.reset();
          this.statusMessage.set(
            'Invitation accepted. Complete phone verification with the 6-digit code, or request a new code below.',
          );
          this.state.set('OTP');
        },
        error: (error) => {
          this.errorMessage.set(this.acceptanceError(error));
        },
      });
  }

  protected verifyOtp(): void {
    if (this.isSubmitting()) return;
    this.errorMessage.set('');
    if (this.otpForm.invalid) {
      this.otpForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.authApi
      .verifyAccount(this.identifier(), this.otpForm.controls.otp.value)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.state.set('VERIFIED');
          this.statusMessage.set(
            'Your phone number is verified and driver onboarding is complete. Contact your inviting organization for next steps.',
          );
        },
        error: (error) => {
          this.errorMessage.set(
            error instanceof HttpErrorResponse && [400, 401, 422].includes(error.status)
              ? 'That code is invalid or expired. Check the 6-digit code and try again, or request a new one.'
              : this.apiErrorMessage(error, 'Phone verification could not be completed. Please try again.'),
          );
        },
      });
  }

  protected resendCode(): void {
    if (this.isSubmitting() || !this.identifier()) return;
    this.errorMessage.set('');
    this.statusMessage.set('');
    this.isSubmitting.set(true);
    this.authApi
      .resendVerification(this.identifier())
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.statusMessage.set(
            'The verification resend request was processed. Check your phone for the newest code; delivery is not guaranteed by this response.',
          );
        },
        error: (error) => {
          this.errorMessage.set(
            this.apiErrorMessage(error, 'Unable to request another verification code. Please try again.'),
          );
        },
      });
  }

  private setInvitationError(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 410) {
      this.state.set('EXPIRED');
      this.errorMessage.set('This invitation has expired. Ask the organization that invited you to issue a new invitation.');
      return;
    }
    if (error instanceof HttpErrorResponse && error.status === 409) {
      this.state.set('USED');
      this.errorMessage.set('This invitation has already been accepted, revoked, or used.');
      return;
    }
    if (error instanceof HttpErrorResponse && [400, 404].includes(error.status)) {
      this.state.set('INVALID');
      this.errorMessage.set('This invitation link is invalid. Check the link or ask the inviting organization for help.');
      return;
    }
    this.state.set('ERROR');
    this.errorMessage.set(this.apiErrorMessage(error, 'Unable to load this invitation. Try again.'));
  }

  private acceptanceError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 410) {
      this.state.set('EXPIRED');
      return 'This invitation has expired. Ask the organization that invited you to issue a new invitation.';
    }
    if (error instanceof HttpErrorResponse && error.status === 409) {
      this.state.set('USED');
      return 'This invitation can no longer be accepted. It may have already been used or revoked.';
    }
    if (error instanceof HttpErrorResponse && error.status === 400) {
      return 'The phone number must match the invitation and the password must meet the stated requirements.';
    }
    return this.apiErrorMessage(error, 'Unable to accept this invitation. Check your details and try again.');
  }

  private apiErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const body = error.error as { message?: unknown } | null;
      if (typeof body?.message === 'string' && body.message.trim()) return body.message;
    }
    return fallback;
  }
}
