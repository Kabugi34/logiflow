import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AppearanceService } from '../../core/services/appearance.service';
import { LayoutService } from '../../core/services/layout.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  templateUrl: './topbar.component.html'
})
export class TopbarComponent {
  readonly searchPlaceholder = input('Search...');
  protected readonly appearance = inject(AppearanceService);
  protected readonly layout = inject(LayoutService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected logout(): void {
    this.authService.logout().subscribe(() => void this.router.navigate(['/auth/login']));
  }
}
