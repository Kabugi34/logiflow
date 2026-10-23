import { FormValidationSummaryComponent } from '../../../shared/forms/form-validation-summary.component';
import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { matchingFields } from '../../../core/forms/form-validators';
import { trimmedRequired } from '../../../core/forms/form-validators';

@Component({
  selector: 'app-activate-account',
  standalone: true,
  imports: [FormValidationSummaryComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './activate-account.component.html',
})
export class ActivateAccountComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  protected readonly errorMessage = signal('');
  protected readonly isSubmitting = signal(false);

  protected readonly email = this.route.snapshot.queryParamMap.get('email') ?? '';

  protected readonly activationToken = this.route.snapshot.queryParamMap.get('token') ?? '';

  protected readonly activationState = signal<'READY' | 'EXPIRED' | 'USED' | 'INVALID' | 'ERROR'>(
    this.email && this.activationToken ? 'READY' : 'INVALID',
  );

  protected readonly linkRequested = signal(false);

  protected readonly resendForm = this.formBuilder.nonNullable.group({
    email: [this.email, [trimmedRequired, Validators.email, Validators.maxLength(120)]],
  });

  // Matches the backend: 8–72 characters, with uppercase, lowercase, and digit.
  private readonly passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;

  protected readonly form = this.formBuilder.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.pattern(this.passwordPattern)]],
      confirmPassword: ['', [Validators.required, Validators.pattern(this.passwordPattern)]],
    },
    { validators: matchingFields('password', 'confirmPassword') },
  );

  protected submit(): void {
    if (this.isSubmitting()) return;

    this.errorMessage.set('');

    if (!this.email || !this.activationToken) {
      this.errorMessage.set(
        'This activation link is incomplete. Please use the link from your LogiFlow invitation email.',
      );
      this.activationState.set('INVALID');
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set(
        'Password must be 8–72 characters and include an uppercase letter, a lowercase letter, and a number.',
      );
      return;
    }

    const { password, confirmPassword } = this.form.getRawValue();

    if (password !== confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    this.isSubmitting.set(true);

    this.authService
      .activateAccount({
        email: this.email,
        token: this.activationToken,
        password,
        confirmPassword,
      })
      .subscribe({
        next: () => {
          void this.router.navigate(['/auth/login'], {
            queryParams: { email: this.email },
          });
        },
        error: (error) => {
          this.activationState.set(this.activationFailureState(error));
          this.isSubmitting.set(false);

          if (error instanceof HttpErrorResponse && error.status === 400) {
            this.errorMessage.set(
              'The activation details or password are invalid. Check both password fields and try again.',
            );
          } else if (error instanceof HttpErrorResponse && [401, 404, 410].includes(error.status)) {
            this.errorMessage.set(
              'This activation link is invalid, expired, or already used. Request a new link.',
            );
          } else {
            this.errorMessage.set('Unable to activate your account right now. Please try again.');
          }
        },
      });
  }

  protected requestNewLink(): void {
    if (this.isSubmitting()) return;

    this.errorMessage.set('');
    this.linkRequested.set(false);

    if (this.resendForm.invalid) {
      this.resendForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);

    this.authService.requestActivationLink(this.resendForm.controls.email.value).subscribe({
      next: () => {
        this.linkRequested.set(true);
        this.isSubmitting.set(false);
      },
      error: () => {
        this.errorMessage.set(
          'Unable to request a new activation link right now. Please try again.',
        );
        this.isSubmitting.set(false);
      },
    });
  }

  private activationFailureState(error: unknown): 'EXPIRED' | 'USED' | 'INVALID' | 'ERROR' {
    const body =
      error instanceof HttpErrorResponse && typeof error.error === 'object' && error.error !== null
        ? (error.error as Record<string, unknown>)
        : {};

    const code = typeof body['code'] === 'string' ? body['code'].toLowerCase() : '';

    if (code.includes('expired') || (error instanceof HttpErrorResponse && error.status === 410)) {
      return 'EXPIRED';
    }

    if (
      code.includes('used') ||
      code.includes('redeemed') ||
      (error instanceof HttpErrorResponse && error.status === 409)
    ) {
      return 'USED';
    }

    if (
      code.includes('invalid') ||
      (error instanceof HttpErrorResponse && [400, 401, 404].includes(error.status))
    ) {
      return 'INVALID';
    }

    return 'ERROR';
  }
}
