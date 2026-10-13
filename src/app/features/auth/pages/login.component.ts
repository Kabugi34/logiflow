import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

interface LoginResult {
  redirectPath?: string | null;
  role?: string | null;
  roles?: string[];
  user?: {
    role?: string | null;
    roles?: string[];
  } | null;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  protected readonly errorMessage = signal('');
  protected readonly isSubmitting = signal(false);

  protected readonly form = this.formBuilder.nonNullable.group({
    email: [
      this.route.snapshot.queryParamMap.get('email') ?? '',
      [Validators.required, Validators.email]
    ],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  protected submit(): void {
    if (this.isSubmitting()) return;

    this.errorMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.errorMessage.set('Please enter a valid email and password.');
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.isSubmitting.set(true);

    this.authService.login(email, password).subscribe({
      next: result => {
        const loginResult = result as LoginResult;
        const roles = loginResult.user?.roles ?? loginResult.roles ?? [];
        const role = loginResult.user?.role ?? loginResult.role ?? roles[0];

        const destination =
          loginResult.redirectPath ??
          this.destinationForRole(role) ??
          this.destinationForRoles(roles);

        if (!destination) {
          this.errorMessage.set(
            'Your account does not have a recognized workspace role. Please contact support.'
          );
          this.isSubmitting.set(false);
          return;
        }

        const returnUrl =
          this.route.snapshot.queryParamMap.get('returnUrl');

        const allowedPrefix = this.workspacePrefix(destination);
        const target =
          returnUrl?.startsWith(allowedPrefix)
            ? returnUrl
            : destination;

        this.isSubmitting.set(false);
        void this.router.navigateByUrl(target);
      },
      error: error => {
        this.errorMessage.set(
          error instanceof HttpErrorResponse && error.status === 401
            ? 'Incorrect email or password.'
            : 'Unable to sign in. Please try again.'
        );
        this.isSubmitting.set(false);
      }
    });
  }

  private destinationForRole(role?: string | null): string | null {
    switch (role) {
      case 'MANUFACTURER_ADMIN':
      case 'MANUFACTURER_STAFF':
        return '/manufacturer/dashboard';

      case 'DISTRIBUTOR_ADMIN':
      case 'DISTRIBUTOR_STAFF':
        return '/distributor/dashboard';

      case 'PLATFORM_ADMIN':
      case 'SUPER_ADMIN':
        return '/dashboard';

      default:
        return null;
    }
  }

  private destinationForRoles(roles: string[]): string | null {
    for (const role of roles) {
      const destination = this.destinationForRole(role);
      if (destination) return destination;
    }
    return null;
  }

  private workspacePrefix(destination: string): string {
    if (destination.startsWith('/manufacturer/')) {
      return '/manufacturer/';
    }

    if (destination.startsWith('/distributor/')) {
      return '/distributor/';
    }

    return '/dashboard';
  }
}
