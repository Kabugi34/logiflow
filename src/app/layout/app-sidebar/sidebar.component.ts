import { Component, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LayoutService } from '../../core/services/layout.service';
import { WorkspaceConfig } from '../navigation/navigation.config';
import { NavIconComponent } from './nav-icon.component';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NavIconComponent],
  templateUrl: './sidebar.component.html',
})
export class SidebarComponent {
  readonly workspace = input.required<WorkspaceConfig>();
  protected readonly layout = inject(LayoutService);

  protected closeOnNavigate(): void {
    if (this.layout.isMobileViewport()) this.layout.closeMobileNav();
  }
}
