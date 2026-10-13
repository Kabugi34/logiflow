import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';

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
      next: user => {
        const destination = user
          ? this.destinationForRole(user.roles[0])
          : null;

        if (!destination) {
          this.errorMessage.set(
            'This portal is available to Manufacturer and Distributor accounts with an assigned workspace role.'
          );
          this.isSubmitting.set(false);
          return;
        }

        const returnUrl =
          this.route.snapshot.queryParamMap.get('returnUrl');

        const workspace = destination.startsWith('/manufacturer/')
          ? 'manufacturer'
          : 'distributor';
        const target = returnUrl && this.validWorkspaceReturnUrl(returnUrl, workspace)
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

      default:
        return null;
    }
  }

  private validWorkspaceReturnUrl(
    returnUrl: string | null,
    workspace: 'manufacturer' | 'distributor'
  ): boolean {
    if (!returnUrl?.startsWith(`/${workspace}/`)) return false;

    const validSections = workspace === 'manufacturer'
      ? ['dashboard', 'products', 'inventory', 'purchase-orders', 'warehouses', 'shipments', 'logistics', 'drivers', 'vehicles', 'staff', 'reports', 'settings']
      : ['dashboard', 'catalog', 'inventory', 'procurement', 'logistics', 'customers', 'orders'];

    try {
      const segments = this.router.parseUrl(returnUrl).root.children['primary']?.segments
        .map(segment => segment.path) ?? [];
      return segments[0] === workspace
        && segments.length > 1
        && validSections.includes(segments[1]);
    } catch {
      return false;
    }
  }
}
