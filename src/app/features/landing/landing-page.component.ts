import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandLogoComponent } from '../../shared/brand-logo.component';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [BrandLogoComponent, RouterLink],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPageComponent {
  protected readonly mobileMenuOpen = signal(false);
  protected readonly currentYear = new Date().getFullYear();

  protected closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
  }

  protected scrollToSection(event: MouseEvent, sectionId: string): void {
    event.preventDefault();

    const section = document.getElementById(sectionId);
    if (!section) {
      throw new Error(`Landing page section "${sectionId}" was not found.`);
    }

    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}${window.location.search}#${sectionId}`,
    );
    section.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
  }
}
