import { Component, inject, input } from '@angular/core';
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
}
