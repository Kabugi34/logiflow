import {
  Component,
  ElementRef,
  HostListener,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { AuthenticatedImageComponent } from '../../shared/authenticated-image.component';
import { AppearanceService } from '../../core/services/appearance.service';
import { LayoutService } from '../../core/services/layout.service';
import { ProfileService } from '../../features/profile/profile.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink, AuthenticatedImageComponent],
  templateUrl: './topbar.component.html',
})
export class TopbarComponent implements OnInit {
  readonly searchPlaceholder = input('Search...');
  protected readonly appearance = inject(AppearanceService);
  protected readonly layout = inject(LayoutService);
  protected readonly authService = inject(AuthService);
  protected readonly profileService = inject(ProfileService);
  private readonly router = inject(Router);
  private readonly profileMenu = viewChild<ElementRef<HTMLElement>>('profileMenu');
  private readonly profileButton = viewChild<ElementRef<HTMLButtonElement>>('profileButton');
  protected readonly profileOpen = signal(false);
  protected readonly loggingOut = signal(false);

  ngOnInit(): void {
    this.profileService.getMe().subscribe({ error: () => undefined });
  }

  protected readonly profileRoute = () =>
    this.authService.user()?.organization.type === 'DISTRIBUTOR'
      ? '/distributor/profile'
      : '/manufacturer/profile';

  protected roleLabel(role: string): string {
    return role
      .toLowerCase()
      .split('_')
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join(' ');
  }

  protected toggleProfile(): void {
    this.profileOpen.update((open) => !open);
  }

  protected closeProfile(): void {
    this.profileOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  protected dismissOnOutsideClick(event: MouseEvent): void {
    const menu = this.profileMenu()?.nativeElement;
    if (menu && !menu.contains(event.target as Node)) this.closeProfile();
  }

  @HostListener('document:keydown.escape')
  protected dismissOnEscape(): void {
    if (!this.profileOpen()) return;
    this.closeProfile();
    this.profileButton()?.nativeElement.focus();
  }

  protected logout(): void {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    this.authService.logout().subscribe(() => void this.router.navigate(['/auth/login']));
  }
}
