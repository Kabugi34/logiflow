import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

@Component({
  selector: 'app-activate-account',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './activate-account.component.html'
})
export class ActivateAccountComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  protected readonly errorMessage = signal('');

  protected readonly form = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    organizationEmail: ['', [Validators.required, Validators.email]],
    invitationOtp: ['', [Validators.required, Validators.minLength(4)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(8)]]
  });

  constructor() {
    const email = this.route.snapshot.queryParamMap.get('email') ?? '';
    const organizationEmail = this.route.snapshot.queryParamMap.get('organizationEmail') ?? '';
    const otp = this.route.snapshot.queryParamMap.get('otp') ?? '';

    this.form.patchValue({
      email,
      organizationEmail,
      invitationOtp: otp
    });
  }

  protected submit(): void {
    this.errorMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Please correct the highlighted fields before activating your account.');
      return;
    }

    const { password, confirmPassword } = this.form.getRawValue();
    if (password !== confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    try {
      const invite = this.authService.activateAccount(this.form.getRawValue());
      this.authService.setUser(invite.user);
      void this.router.navigate([invite.user.roles.includes('MANUFACTURER_ADMIN') ? '/manufacturer/dashboard' : '/distributor/dashboard']);
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to activate your account.');
    }
  }
}
