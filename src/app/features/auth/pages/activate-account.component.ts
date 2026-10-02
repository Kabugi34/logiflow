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
  protected readonly email = this.route.snapshot.queryParamMap.get('email') ?? '';
  protected readonly activationToken = this.route.snapshot.queryParamMap.get('token') ?? '';

  protected readonly form = this.formBuilder.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(8)]]
  });

  protected submit(): void {
    this.errorMessage.set('');

    if (!this.email || !this.activationToken) {
      this.errorMessage.set('This activation link is incomplete. Please use the link from your LogiFlow invitation email.');
      return;
    }

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
      this.authService.activateAccount({
        email: this.email,
        activationToken: this.activationToken,
        password,
        confirmPassword
      });
      void this.router.navigate(['/auth/login'], { queryParams: { email: this.email } });
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Unable to activate your account.');
    }
  }
}
