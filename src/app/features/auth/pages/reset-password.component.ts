import { FormValidationSummaryComponent } from '../../../shared/forms/form-validation-summary.component';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { LoadingIndicatorComponent } from '../../../shared/loading/loading-indicator.component';
import { matchingFields } from '../../../core/forms/form-validators';
import { trimmedRequired } from '../../../core/forms/form-validators';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-reset-password',
  imports: [FormValidationSummaryComponent, LoadingIndicatorComponent, ReactiveFormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
})
export class ResetPasswordComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  protected readonly token = this.route.snapshot.queryParamMap.get('token') ?? '';
  protected readonly successMessage = signal('');
  protected readonly errorMessage = signal('');
  protected readonly isSubmitting = signal(false);

  protected readonly requestForm = this.formBuilder.nonNullable.group({
    email: ['', [trimmedRequired, Validators.email, Validators.maxLength(120)]],
  });

  protected readonly resetForm = this.formBuilder.nonNullable.group(
    {
      email: [
        this.route.snapshot.queryParamMap.get('email') ?? '',
        [trimmedRequired, Validators.email, Validators.maxLength(120)],
      ],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required, Validators.minLength(8)]],
    },
    { validators: matchingFields('password', 'confirmPassword') },
  );

  protected requestReset(): void {
    if (this.isSubmitting()) return;
    this.errorMessage.set('');
    this.successMessage.set('');
    if (this.requestForm.invalid) {
      this.requestForm.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    this.authService.requestPasswordReset(this.requestForm.controls.email.value).pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
      next: () => {
        this.successMessage.set(
          'If an account exists for that email, a password reset link will be sent.',
        );
      },
      error: () => {
        this.errorMessage.set('Unable to request a password reset right now. Please try again.');
      },
    });
  }

  protected resetPassword(): void {
    if (this.isSubmitting()) return;
    this.errorMessage.set('');
    this.successMessage.set('');
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }
    const { email, password, confirmPassword } = this.resetForm.getRawValue();
    if (password !== confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }
    if (!this.token) {
      this.errorMessage.set('This password reset link is incomplete. Request a new link.');
      return;
    }
    this.isSubmitting.set(true);
    this.authService.resetPassword({ email, token: this.token, password }).pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
      next: () => {
        this.successMessage.set('Your password has been reset. You can now sign in.');
      },
      error: () => {
        this.errorMessage.set('Unable to reset your password. The link may be invalid or expired.');
      },
    });
  }
}
